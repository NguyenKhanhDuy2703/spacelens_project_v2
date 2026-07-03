# ============================================================
# ObjectTracking — Wrapper tổng hợp YOLO + ByteTrack
# ============================================================
# Trước đây dùng DeepSORT (deep_sort_realtime).
# Đã chuyển sang ByteTrack vì:
#   1. ByteTrack không cần CNN appearance model → nhanh hơn
#   2. Phù hợp Edge AI (không cần GPU riêng cho tracker)
#   3. 2-stage matching giúp giữ track tốt hơn khi bị che khuất
#
# API mới (Ultralytics hiện tại):
#   - YOLO.predict() trả về list[Results]
#   - BYTETracker.update() nhận Results[0] trực tiếp (không cần convert)
#   - Bỏ bước tranform_detections() — không còn cần thiết
# ============================================================

from .yolov8_model import YOLOv8Model
from .bytetrack_model import ByteTrackModel


class ObjectTracking:
    def __init__(self, config):
        self.yolo_model = YOLOv8Model(config["yolov8_config_path"])
        self.bytetrack_model = ByteTrackModel(config["bytetrack_config"])

    def process_single_frame(self, frame) -> list:
        """
        Chạy toàn bộ pipeline detection + tracking cho 1 frame.

        Returns:
            list[_ByteTrackResult]: Các track đang active.
                Mỗi phần tử có: track_id, is_confirmed(), to_ltrb(), features, final_track_id.
        """
        results = self.yolo_model.predict_frame(frame)

        if not results or results[0].boxes is None or len(results[0].boxes) == 0:
            # Không có detection — vẫn cần update tracker để Kalman tiếp tục dự đoán
            return self.bytetrack_model.tracker_predict(results[0], frame)

        # Truyền thẳng Results[0] vào ByteTrack — không cần convert numpy
        return self.bytetrack_model.tracker_predict(results[0], frame)