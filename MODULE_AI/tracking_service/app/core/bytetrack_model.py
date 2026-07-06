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

        frame_rate = bt_cfg.get("frame_rate", 30)
        tracker_args.track_buffer = bt_cfg.get("track_buffer", tracker_args.track_buffer)

        self.tracker = BYTETracker(args=tracker_args, frame_rate=frame_rate)

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
        self.features = None       
        self.final_track_id = None 

    @property
    def track_id(self) -> int:
        return int(self._row[4])

    def is_confirmed(self) -> bool:
        return True

    def to_ltrb(self) -> list:
        return self._row[:4].tolist()
