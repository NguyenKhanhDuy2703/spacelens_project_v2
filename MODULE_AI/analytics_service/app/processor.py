from app.core.analyzer_registry import CameraAnalyzerRegistry
from app.communication.event_dispatcher import EventDispatcher
from app.schemas.tracking_event import TrackingEventSchema
from app.utils.event_builders import bbox_center, build_zone_events, build_dwell_events, build_heatmap_event


def process_event(event: TrackingEventSchema, registry: CameraAnalyzerRegistry, dispatcher: EventDispatcher):
    """Xử lý 1 tracking event = 1 frame snapshot của 1 camera (nhiều người trong 1 frame).
    Chạy qua Zone + Dwell + Heatmap, publish qua EventDispatcher (throttle heatmap ở đó).
    """

    # Lấy (hoặc tạo mới nếu camera này lần đầu xuất hiện) bộ 3 analyzer RIÊNG cho camera_id này.
    # Đây là điểm cách ly đa camera — mỗi camera có state Zone/Dwell/Heatmap độc lập,
    # tránh 1 instance global bị nhiều camera ghi đè lẫn nhau.
    analyzers = registry.get_or_create(event.camera_id, frame_w=event.frame_width, frame_h=event.frame_height)

    # Danh sách polygon zone của camera này, đã load sẵn lúc get_or_create (hiện đang hardcode
    # qua ZoneProvider, xem app/core/zone_provider.py).
    zones = analyzers["zones_cache"]

    out_events = []

    # Lặp qua từng người (track) có mặt trong frame này.
    for track in event.tracks:
        # Quy điểm bbox [left, top, right, bottom] về 1 điểm tâm duy nhất — điểm đại diện
        # vị trí người đó, dùng chung cho cả zone check lẫn heatmap.
        center = bbox_center(track.bbox)

        # 1) ZONE ANALYSIS: kiểm tra điểm tâm đang nằm trong zone nào, so với zone lần trước
        # của track_id này → sinh sự kiện ENTRY / EXIT / TRANSITION nếu có thay đổi.
        # _hit_zones (danh sách zone_id đang chạm) không dùng tới ở đây, chỉ cần zone_events.
        _hit_zones, zone_events = analyzers["zone"].analyze(
            center, zones, track_id=track.id,
            frame_w=analyzers["frame_w"], frame_h=analyzers["frame_h"],
        )
        # Convert sự kiện zone thô (dict) thành ZoneEventPayload (schema chuẩn để publish).
        out_events += build_zone_events(event.camera_id, event.timestamp, zone_events)

        # 2) DWELL TIME ANALYSIS: cập nhật thời gian đứng yên của track này dựa trên IoU
        # giữa bbox hiện tại và bbox lần trước — chỉ cập nhật state, sự kiện "dừng đủ lâu"
        # (dwell_stop) được finalize và lấy ra riêng ở dòng dưới (get_new_events()).
        analyzers["dwell"].update_dwell_time(track.id, track.bbox)

        # 3) HEATMAP ANALYSIS: cộng dồn "nhiệt" vào ô lưới chứa điểm tâm này.
        analyzers["heatmap"].update_grid_cell(center[0], center[1])

    # Sau khi xử lý xong hết người trong frame: lấy các sự kiện "dừng lại đủ lâu" mà
    # DwellTimeAnalysis đã finalize trong vòng lặp trên (finalize_stop_event được gọi nội bộ
    # khi track di chuyển ra khỏi vị trí dwell), rồi xoá khỏi hàng đợi nội bộ để không publish lặp.
    out_events += build_dwell_events(event.camera_id, analyzers["dwell"].get_new_events())

    # 4) HEATMAP EVENT: đóng gói snapshot ma trận heatmap hiện tại của camera này mỗi frame.
    # Không throttle ở đây — EventDispatcher tự quyết định có publish hay bỏ qua dựa trên
    # HEATMAP_PUBLISH_INTERVAL_SEC (xem app/communication/event_dispatcher.py).
    out_events.append(build_heatmap_event(
        event.camera_id, event.timestamp, analyzers["heatmap"].get_payload_heatmap(),
    ))

    # Dọn các track không còn active (không xuất hiện > 300s mặc định) khỏi bộ nhớ dwell,
    # đồng thời dọn luôn trạng thái zone tương ứng của track đó trong analyzers["zone"]
    # (truyền zone_analyzer vào để cleanup đúng instance của CAMERA NÀY, không tạo instance rác).
    analyzers["dwell"].cleanup_old_tracks(zone_analyzer=analyzers["zone"])

    # Đóng gói + định tuyến từng event ra đúng stream theo loại (zone/dwell đều publish
    # ngay, không throttle — xem app/communication/event_dispatcher.py).
    for e in out_events:
        dispatcher.dispatch(e)
