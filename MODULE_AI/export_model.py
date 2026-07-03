import os
import logging
import shutil
os.environ['SETTINGS_DATASETS_DIR'] = os.path.join(os.getcwd(), 'datasets')
from ultralytics import YOLO, settings
def export_model():
    current_dir = os.getcwd()
    settings.update({'datasets_dir': os.path.join(current_dir, 'datasets')})
    dataset_path = os.path.join(current_dir, 'datasets')
    model_path = os.path.join('weights', 'yolov8m.pt')
    
    if not os.path.exists(model_path):
        logging.error(f"Model file not found at: {model_path}")
        return

    try:
        model = YOLO(model_path)
        logging.info(f"Starting model optimization: {model_path} -> OpenVINO INT8")
        model.export(
            format='openvino', 
            half=True,
            data='coco128.yaml', 
            device='cpu',
        ) 
        logging.info("Optimization process completed successfully!")
        logging.info(f"Exported model folder: {model_path.replace('.pt', '_openvino_model')}")
        if os.path.exists(dataset_path):
            shutil.rmtree(dataset_path)
            logging.info(f"Đã dọn dẹp folder dataset: {dataset_path}")
    except Exception as e:
        logging.error(f"An error occurred during the export process: {str(e)}")
if __name__ == "__main__":
    export_model()