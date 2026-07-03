import math
import time
from numba import jit
import numpy as np
from app.analytics.zone_analysis import ZoneAnalysis
@jit(nopython=True)
def calculate_iou(boxA, boxB):
    xA = max(boxA[0], boxB[0])
    yA = max(boxA[1], boxB[1])
    xB = min(boxA[2], boxB[2])
    yB = min(boxA[3], boxB[3])
    
    interArea = max(0.0, xB - xA + 1) * max(0.0, yB - yA + 1)
    if interArea == 0.0:
        return 0.0
    boxAArea = (boxA[2] - boxA[0] + 1) * (boxA[3] - boxA[1] + 1)
    boxBArea = (boxB[2] - boxB[0] + 1) * (boxB[3] - boxB[1] + 1)
    
    iou = interArea / float(boxAArea + boxBArea - interArea)
    return iou

class DwellTimeAnalysis:
    def __init__(self, iou_threshold=0.7 , time_threshold=2.0):
        self.iou_threshold = iou_threshold
        self.time_threshold = time_threshold
        self.dwell_times = {}
        self.finished_events = [] 

    def finalize_stop_event(self, track_id):
        obj_dwell_time = self.dwell_times.get(track_id)
        if not obj_dwell_time or obj_dwell_time["dwell_time"] <= 0:
            return
            
        event_stop_payload = {
            "track_id": track_id,
            "event_type": "stop",
            "dwell_time": round(obj_dwell_time["dwell_time"], 2),
            "pos_x": int(obj_dwell_time["last_pos"][0]), 
            "pos_y": int(obj_dwell_time["last_pos"][1]),
            "zone_id": obj_dwell_time.get("current_zone"),  # zone đúng của track này
            "timestamp": time.time()
        }
        
        self.finished_events.append(event_stop_payload)
        obj_dwell_time["dwell_time"] = 0.0

    def update_dwell_time(self, track_id, current_pos ):
        timestamp = time.time()
        
        current_pos = np.array(current_pos, dtype=np.float32)

        if track_id not in self.dwell_times:
            self.dwell_times[track_id] = {
                "dwell_time": 0.0,
                "last_pos": current_pos, 
                "last_update": timestamp,
                "active": True,
            }
            return 

        obj_dwell_time = self.dwell_times[track_id]
        
        iou_score = calculate_iou(obj_dwell_time["last_pos"], current_pos)

        if iou_score > self.iou_threshold :
        
            time_diff = timestamp - obj_dwell_time["last_update"]
            obj_dwell_time["dwell_time"] += time_diff
        else:
            if obj_dwell_time["dwell_time"] >= self.time_threshold:
                self.finalize_stop_event(track_id)
            else:
                obj_dwell_time["dwell_time"] = 0.0
            obj_dwell_time["last_pos"] = current_pos
            

        obj_dwell_time["last_update"] = timestamp

    def alert_stopped_objects(self, track_id, zone_id=None):
        obj=self.dwell_times.get(track_id)
        if not obj or obj["dwell_time"] < self.time_threshold:
            return None
        ping_payload = {
            "event_type": "ping",
            "track_id": track_id,
            "dwell_time": round(obj["dwell_time"], 2) if obj else 0.0,
            "zone_id": zone_id,  # zone hiện tại của track — dùng để match rule
        }
        return ping_payload
    def get_new_events(self):
        events = self.finished_events[:]
        self.finished_events = [] 
        return events
    def cleanup_old_tracks(self , max_age = 300):
        current_time = time.time()
        to_delete = []
        for track_id , data in self.dwell_times.items():
            if current_time - data["last_update"] > max_age:
                to_delete.append(track_id)
        for track_id in to_delete:
            del self.dwell_times[track_id]
            ZoneAnalysis().cleanup_event_person_zone(track_id)

    def flush_all_active(self):
        """Gọi finalize_stop_event cho tất cả track đang tích lũy dwell_time.
        Dùng khi stream kết thúc để không mất data của người đứng yên đến cuối video."""
        for track_id in list(self.dwell_times.keys()):
            obj = self.dwell_times.get(track_id)
            if obj and obj["dwell_time"] >= self.time_threshold:
                self.finalize_stop_event(track_id)