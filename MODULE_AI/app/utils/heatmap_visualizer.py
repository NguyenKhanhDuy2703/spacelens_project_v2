import cv2
import numpy as np

class HeatmapVisualizer:
    def __init__(self, alpha=0.55):
        self.alpha = alpha
    def draw_grid(self, frame, grid_size):
        h, w = frame.shape[:2]
        for i in range(0, h, grid_size):
            cv2.line(frame, (0, i), (w, i), (255, 255, 255), 1)
        for j in range(0, w, grid_size):
            cv2.line(frame, (j, 0), (j, h), (255, 255, 255), 1)
        return frame

    def apply_heatmap_overlay(self, frame, heatmap_matrix, grid_size):
        h, w = frame.shape[:2]
        heatmap_blur = cv2.GaussianBlur(heatmap_matrix, (0, 0), sigmaX=0.5)
        if np.max(heatmap_blur) > 0:
            norm_heatmap = np.uint8(255 * heatmap_blur / np.max(heatmap_blur))
        else:
            norm_heatmap = np.uint8(heatmap_blur)
        heatmap_resized = cv2.resize(norm_heatmap, (w, h), interpolation=cv2.INTER_CUBIC)
        heatmap_color = cv2.applyColorMap(heatmap_resized, cv2.COLORMAP_JET)
        overlay = cv2.addWeighted(frame, self.alpha, heatmap_color, 1 - self.alpha, 0)
        return overlay