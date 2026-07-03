# ============================================================
# ByteTrack Tracker Wrapper
# ============================================================
# Thay thế DeepSortModel bằng ByteTrackModel.
#
# API thay đổi theo phiên bản Ultralytics mới:
#   - Cũ: tracker.update(np.ndarray, img_size=..., orig_img_size=...)
#   - Mới: tracker.update(Boxes, img=frame)
#     → Nhận results[0].boxes (đối tượng Boxes, có .conf/.xywh/.cls)
#     → Trả về np.ndarray shape (N, 8) = [x1, y1, x2, y2, track_id, score, cls, idx]
#
# Interface bên ngoài (ObjectTracking) giữ nguyên để không phải
# thay đổi code ở tầng stream_processing.py.
# ============================================================

from ultralytics.trackers import BYTETracker
from types import SimpleNamespace
import numpy as np


class ByteTrackModel:
    """
    Wrapper cho BYTETracker của Ultralytics (API mới).

    tracker_predict(yolo_results, frame) → list[_ByteTrackResult]

    Mỗi track trả về có các thuộc tính:
        - track_id (int)        : ID duy nhất của track
        - is_confirmed() (bool) : True nếu track đang active
        - to_ltrb() (list)      : [x1, y1, x2, y2] bounding box
        - features (None)       : ByteTrack không có appearance feature
        - final_track_id (str)  : Được gán bởi stream_processing
    """

    def __init__(self, config: dict):
        bt_cfg = config.get("bytetrack", {})

        tracker_args = SimpleNamespace(
            track_high_thresh=bt_cfg.get("track_high_thresh", 0.5),
            track_low_thresh=bt_cfg.get("track_low_thresh", 0.1),
            new_track_thresh=bt_cfg.get("new_track_thresh", 0.6),
            track_buffer=bt_cfg.get("track_buffer", 30),
            match_thresh=bt_cfg.get("match_thresh", 0.8),
            fuse_score=True,
        )

        # Use configurable frame_rate (helpful for low-FPS sources)
        frame_rate = bt_cfg.get("frame_rate", 30)
        # Increase default track_buffer tolerance for low-FPS streams if not provided
        tracker_args.track_buffer = bt_cfg.get("track_buffer", tracker_args.track_buffer)

        self.tracker = BYTETracker(args=tracker_args, frame_rate=frame_rate)

    def tracker_predict(self, yolo_results, frame: np.ndarray) -> list:
        """
        Chạy ByteTrack trên một frame.

        Args:
            yolo_results: Đối tượng Results của Ultralytics (results[0]).
            frame (np.ndarray): Frame hiện tại (dùng cho Global Motion Compensation).

        Returns:
            list[_ByteTrackResult]: List các track object, mỗi object có:
                - track_id (int)
                - is_confirmed() → bool
                - to_ltrb()     → [x1, y1, x2, y2]
                - features      → None
        """
        # BYTETracker.update() nhận Boxes object (results[0].boxes),
        # không phải Results object (results[0]).
        # Boxes có .conf, .xywh, .cls — đây là format tracker cần.
        boxes = yolo_results.boxes

        if boxes is None or len(boxes) == 0:
            return []

        # API: update(Boxes, img=frame)
        # Trả về np.ndarray shape (N, 8): [x1, y1, x2, y2, track_id, score, cls, idx]
        raw = self.tracker.update(boxes, img=frame)

        if raw is None or len(raw) == 0:
            return []

        return [_ByteTrackResult(row) for row in raw]


class _ByteTrackResult:
    """
    Adapter wrapper để mỗi hàng numpy từ BYTETracker.update()
    có interface giống Track của DeepSORT cũ.

    Format mỗi hàng: [x1, y1, x2, y2, track_id, score, cls, idx]
    Index:            0   1   2   3    4          5      6    7
    """

    def __init__(self, row: np.ndarray):
        self._row = row
        self.features = None       # ByteTrack không có appearance feature
        self.final_track_id = None # Được gán bởi stream_processing

    @property
    def track_id(self) -> int:
        return int(self._row[4])

    def is_confirmed(self) -> bool:
        # update() chỉ trả về các track đã is_activated → luôn True
        return True

    def to_ltrb(self) -> list:
        """Trả về [x1, y1, x2, y2]."""
        return self._row[:4].tolist()
