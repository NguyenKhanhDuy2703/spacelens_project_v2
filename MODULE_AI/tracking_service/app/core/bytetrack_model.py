from ultralytics.trackers import BYTETracker
from types import SimpleNamespace
import numpy as np


class ByteTrackModel:

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

        tracker_args.track_buffer = bt_cfg.get("track_buffer", tracker_args.track_buffer)
        frame_rate = bt_cfg.get("frame_rate", 30)
        tracker_args.frame_rate = frame_rate

        self.tracker = BYTETracker(args=tracker_args)

    def tracker_predict(self, yolo_results, frame: np.ndarray) -> list:
        boxes = yolo_results.boxes
        if boxes is None or len(boxes) == 0:
            return []
        raw = self.tracker.update(boxes, img=frame)

        if raw is None or len(raw) == 0:
            return []

        return [_ByteTrackResult(row) for row in raw]


class _ByteTrackResult:

    def __init__(self, row: np.ndarray):
        self._row = row

    @property
    def track_id(self) -> int:
        return int(self._row[4])

    def is_confirmed(self) -> bool:
        return True

    def to_ltrb(self) -> list:
        return self._row[:4].tolist()

    @property
    def score(self) -> float:
        return float(self._row[5]) if len(self._row) > 5 else 1.0

    @property
    def width(self) -> float:
        return float(self._row[2] - self._row[0])

    @property
    def height(self) -> float:
        return float(self._row[3] - self._row[1])

    @property
    def area(self) -> float:
        return self.width * self.height

    @property
    def aspect_ratio(self) -> float:
        h = self.height
        return self.width / h if h > 0 else 0.0

    def get_crop(self, frame: np.ndarray) -> np.ndarray:
        x1, y1, x2, y2 = self.to_ltrb()
        x1, y1, x2, y2 = int(x1), int(y1), int(x2), int(y2)
        h, w = frame.shape[:2]
        x1, y1 = max(0, x1), max(0, y1)
        x2, y2 = min(w, x2), min(h, y2)
        return frame[y1:y2, x1:x2]
