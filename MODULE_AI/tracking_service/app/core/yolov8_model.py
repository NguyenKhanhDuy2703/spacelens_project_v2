from ultralytics import YOLO

class YOLOv8Model:
    def __init__(self , config):
        model_path = config['yolov8']['model_path']
        self.conf_threshold = config['yolov8']['confidence_threshold']
        self.model = YOLO(model_path, task='detect')
        self.classes = config['yolov8']['classes']
        self.iou_threshold = config['yolov8']['iou_threshold']
    def predict_frame(self, frame):
        results = self.model(frame, conf=self.conf_threshold , classes=self.classes, iou=self.iou_threshold , verbose=False ) 
        return results