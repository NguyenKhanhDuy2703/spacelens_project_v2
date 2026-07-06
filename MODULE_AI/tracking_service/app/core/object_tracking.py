from .yolov8_model import YOLOv8Model
from .bytetrack_model import ByteTrackModel


class ObjectTracking:
    def __init__(self, config):
        self.yolo_model = YOLOv8Model(config["yolov8_config_path"])
        self.bytetrack_model = ByteTrackModel(config["bytetrack_config"])

    def process_single_frame(self, frame) -> list:
        results = self.yolo_model.predict_frame(frame)

        if not results or results[0].boxes is None or len(results[0].boxes) == 0:
            return self.bytetrack_model.tracker_predict(results[0], frame)

        return self.bytetrack_model.tracker_predict(results[0], frame)