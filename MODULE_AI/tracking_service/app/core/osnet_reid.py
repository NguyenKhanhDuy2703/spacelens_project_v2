import cv2
import numpy as np
import logging
from openvino import Core

class OSNetReID:
    def __init__(self, model_path: str = "weights/osnet_x1_0.onnx"):
        try:
            self.ie = Core()
            self.model = self.ie.read_model(model=model_path)
            self.compiled_model = self.ie.compile_model(model=self.model, device_name="AUTO")
            self.input_layer = self.compiled_model.input(0)
            self.output_layer = self.compiled_model.output(0)
            
            # OSNet standard input size is usually 256x128 (HxW)
            self.input_size = (128, 256) # (width, height) for cv2.resize
            logging.info(f"[OSNet] Successfully loaded OpenVINO model from {model_path}")
        except Exception as e:
            logging.error(f"[OSNet] Failed to load OpenVINO model at {model_path}: {e}")
            self.compiled_model = None

    def compute_sharpness(self, img: np.ndarray) -> float:
        """
        Compute image sharpness using Variance of Laplacian.
        Returns a normalized weight between 0.1 and 1.0.
        """
        if img is None or img.size == 0:
            return 0.1
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        variance = cv2.Laplacian(gray, cv2.CV_64F).var()
        
        # Normalize: assuming variance > 500 is very sharp, < 50 is blurry
        weight = min(max(variance / 500.0, 0.1), 1.0)
        return float(weight)

    def extract_feature(self, img: np.ndarray) -> np.ndarray:
        """
        Preprocess the cropped image and extract the feature vector using OSNet.
        """
        if self.compiled_model is None or img is None or img.size == 0:
            return np.zeros((512,), dtype=np.float32)

        try:
            # Preprocessing for OSNet
            img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
            img_resized = cv2.resize(img_rgb, self.input_size)
            
            # HWC -> CHW
            img_chw = img_resized.transpose((2, 0, 1))
            
            # Normalize with ImageNet mean and std
            img_chw = img_chw.astype(np.float32) / 255.0
            mean = np.array([0.485, 0.456, 0.406]).reshape(3, 1, 1)
            std = np.array([0.229, 0.224, 0.225]).reshape(3, 1, 1)
            img_normalized = (img_chw - mean) / std
            
            # Add batch dimension: NCHW
            input_tensor = np.expand_dims(img_normalized, 0)
            
            # Inference
            result = self.compiled_model([input_tensor])[self.output_layer]
            
            # Flatten and normalize vector (L2 norm)
            feature = result.flatten()
            norm = np.linalg.norm(feature)
            if norm > 0:
                feature = feature / norm
                
            return feature
        except Exception as e:
            logging.error(f"[OSNet] Error during feature extraction: {e}")
            return np.zeros((512,), dtype=np.float32)
