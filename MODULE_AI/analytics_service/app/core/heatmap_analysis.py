import numpy as np
class HeatmapAnalysis:
    def __init__(self,  frame_width , frame_height , grid_size = 40 , decay = 0.99998):
        self.frame_width = frame_width
        self.frame_height = frame_height
        self.grid_size = grid_size
        self.grid_width = int(np.ceil(frame_width / grid_size))
        self.grid_height = int(np.ceil(frame_height / grid_size))
        self.decay = decay
        self.heatmap_matrix = np.zeros((self.grid_height , self.grid_width) ,dtype=np.float32) 
        
    def _get_grid_cell (self , x , y):
        grid_x = int(x / self.grid_size)
        grid_y = int(y / self.grid_size)
        return grid_x , grid_y
    def update_grid_cell(self , x , y):
        self.heatmap_matrix *= self.decay
        grid_x , grid_y = self._get_grid_cell(x , y)
        if 0 <= grid_x < self.grid_width and 0 <= grid_y < self.grid_height :
            self.heatmap_matrix[grid_y , grid_x] += 0.5
            self.heatmap_matrix = np.clip(self.heatmap_matrix , 0 , 255) 
    def reset_heatmap(self):
        self.heatmap_matrix = np.zeros((self.grid_height , self.grid_width) ,dtype=np.float32)
    def get_payload_heatmap(self):
        return {
            "frame_height" : self.frame_height ,
            "frame_width" : self.frame_width ,
            "grid_size" : self.grid_size ,
            "grid_width" : self.grid_width ,
            "grid_height" : self.grid_height ,
            "heatmap_matrix" : self.heatmap_matrix.tolist() ,
        }