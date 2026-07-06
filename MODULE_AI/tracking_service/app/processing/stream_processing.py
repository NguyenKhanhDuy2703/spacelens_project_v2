from ..core import object_tracking
from ..config import settings
import cv2
import threading
import logging
import time
from .stream_reader import StreamReader
from app.utils.visualizer import draw_tracks
from app.communication.redis_publish import RedisPublisher

class StreamProcessor:
    
    def __init__(self):
        self.stream_reader = None
        self.publisher = RedisPublisher()




   
    def process_stream(self, url_rtsp , list_zone , camera_id , location_id , stop_event : threading.Event ): 
        try:
            yolo_model_path = settings.read_yaml_config(settings.YOLOV8_CONFIG_PATH)
            bytetrack_config = settings.read_yaml_config(settings.BYTETRACK_CONFIG_PATH)

            self.object_tracker = object_tracking.ObjectTracking({
                "yolov8_config_path": yolo_model_path,
                "bytetrack_config": bytetrack_config,  
            })
            self.camera_id = camera_id

            # Initialize and start StreamReader
            self.stream_reader = StreamReader(target_size=(640, 640), queue_size=3)
            self.stream_reader.start_read(url_rtsp)

            # Wait for first frame to fetch metadata
            processed_first, meta = None, None
            for _ in range(100): # max 10 seconds timeout
                processed_first, meta = self.stream_reader.get_frame(timeout=0.1)
                if processed_first is not None:
                    break
            
            if processed_first is None or meta is None:
                raise ValueError(f"Failed to read and preprocess first frame from StreamReader: {url_rtsp}")

            self.letterbox_meta = meta
            windown_name = f"AI Tracking - {url_rtsp}"
           
            while not stop_event.is_set():
                frame, meta = self.stream_reader.get_frame(timeout=0.1)
                if frame is None:
                    if not self.stream_reader.running:
                        logging.info("[StreamProcessor] StreamReader stopped. Exiting loop.")
                        break
                    continue
                
                # Run Object Tracking (YOLO + ByteTrack)
                tracks = self.object_tracker.process_single_frame(frame)
                
                # Pack and publish tracking data to Redis
                track_data = []
                for track in tracks:
                    if not track.is_confirmed():
                        continue
                    track_id = getattr(track, 'final_track_id', None) or getattr(track, 'track_id', None)
                    if track_id is None:
                        continue
                    ltrb = track.to_ltrb()
                    track_data.append({
                        "id": track_id,
                        "bbox": [float(x) for x in ltrb]
                    })
                
                if track_data:
                    payload = {
                        "camera_id": self.camera_id,
                        "location_id": location_id,
                        "timestamp": time.time(),
                        "tracks": track_data
                    }
                    self.publisher.publish("tracking_events", payload)
                
                # Draw tracking boxes
                frame = draw_tracks(frame, tracks)
                
                # Display debug window
                cv2.imshow(windown_name, frame)
                
                if cv2.waitKey(25) & 0xFF == ord('q'):
                    stop_event.set()
                    break
        except Exception as e:
            logging.exception("Critical error in process_stream")
            raise Exception(f"Error processing stream {url_rtsp}: {str(e)}")            
        finally:
            if self.stream_reader:
                self.stream_reader.stop()
            stop_event.set()
            for _ in range(5):
                cv2.waitKey(1)
            cv2.destroyAllWindows()
    def stop(self , stop_event : threading.Event):
        stop_event.set() 
        return True
                                                 
