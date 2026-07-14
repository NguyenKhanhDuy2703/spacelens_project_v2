from ..core import object_tracking
from ..config import settings
from app.core.osnet_reid import OSNetReID
from app.core.redis import get_all_reid_vectors, save_reid_vector, refresh_ttl
from app.utils.math_utils import cosine_similarity
import cv2
import threading
import logging
import time
import uuid
import numpy as np
from .stream_reader import StreamReader
from app.utils.visualizer import draw_tracks
from app.communication.redis_publish import RedisPublisher

class StreamProcessor:

    def __init__(self):
        self.stream_reader = None
        self.publisher = RedisPublisher()
        self.osnet = OSNetReID()
        self.track_vectors_buffer = {}
        self.final_track_mapping = {}
        self.distance_threshold = 0.82
        self.track_threshold = 0.6
        self.track_area = 500
        self.sharpness_threshold = 0.3

    def _filter_valid_track(self, track, current_track_ids):
        if not track.is_confirmed():
            return None

        track_id = getattr(track, 'track_id', None)
        if track_id is None:
            return None

        current_track_ids.add(track_id)
        # Noise Filtering
        if getattr(track, 'score', 1.0) <= self.track_threshold:
            return None

        area = getattr(track, 'area', 0)
        if area < self.track_area:
            return None

        return track_id

    def _resolve_identity(self, track, frame, camera_id, track_id, current_track_ids):
        # Extraction & Weighting
        crop_img = track.get_crop(frame)
        weight = self.osnet.compute_sharpness(crop_img)

        # Bỏ qua hoàn toàn, không tính vào ngưỡng 5-frame
        if weight < self.sharpness_threshold:
            return None

        feature = self.osnet.extract_feature(crop_img)

        if track_id not in self.track_vectors_buffer:
            self.track_vectors_buffer[track_id] = {
                "vector": np.zeros((512,), dtype=np.float32),
                "count": 0
            }

        self.track_vectors_buffer[track_id]["vector"] += weight * feature
        self.track_vectors_buffer[track_id]["count"] += 1

        # B4: Thresholding & Redis (gom đủ 5 frames)
        if self.track_vectors_buffer[track_id]["count"] < 5:
            return None

        avg_vector = self.track_vectors_buffer[track_id]["vector"]
        norm = np.linalg.norm(avg_vector)
        if norm > 0:
            avg_vector = avg_vector / norm

        all_vectors = get_all_reid_vectors(camera_id)
        best_match_id = None
        best_score = -1

        # Thu thập các UUID đang hiển thị trên màn hình (để chống trùng)
        active_uuids = set(
            self.final_track_mapping.get(t_id)
            for t_id in current_track_ids
            if t_id != track_id and self.final_track_mapping.get(t_id) is not None
        )

        for old_id, old_vec in all_vectors.items():
            # Bỏ qua nếu ID này đang được gán cho một người khác trên cùng khung hình
            if old_id in active_uuids:
                continue

            sim = cosine_similarity(avg_vector, old_vec)
            if sim > best_score:
                best_score = sim
                best_match_id = old_id

        if best_score > self.distance_threshold and best_match_id:
            final_track_id = best_match_id
        else:
            final_track_id = str(uuid.uuid4())
            save_reid_vector(camera_id, final_track_id, avg_vector)

        self.final_track_mapping[track_id] = final_track_id
        del self.track_vectors_buffer[track_id]

        return final_track_id

    def _cleanup_stale_buffers(self, current_track_ids):
        # Garbage Collection & Refresh TTL
        for tid in list(self.track_vectors_buffer.keys()):
            if tid not in current_track_ids:
                del self.track_vectors_buffer[tid]

        for tid in list(self.final_track_mapping.keys()):
            if tid not in current_track_ids:
                del self.final_track_mapping[tid]

    def process_stream(self, url_rtsp, list_zone, camera_id, location_id, stop_event: threading.Event):
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

            last_refresh_time = time.time()

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
                current_track_ids = set()

                filtered_tracks = []
                for track in tracks:
                    track_id = self._filter_valid_track(track, current_track_ids)
                    if track_id is not None:
                        filtered_tracks.append((track, track_id))

                for track, track_id in filtered_tracks:
                    final_track_id = self.final_track_mapping.get(track_id)

                    if final_track_id is None:
                        final_track_id = self._resolve_identity(
                            track, frame, camera_id, track_id, current_track_ids
                        )

                    if final_track_id is None:
                        continue

                    setattr(track, 'final_track_id', final_track_id)
                    ltrb = track.to_ltrb()
                    track_data.append({
                        "id": final_track_id,
                        "bbox": [float(x) for x in ltrb]
                    })

                valid_tracks = [t for t in tracks if getattr(t, 'final_track_id', None) is not None]

                if track_data:
                    detected_ids = [td['id'] for td in track_data]
                    logging.info(f"Detected {len(detected_ids)} people. Tracking IDs: {detected_ids}")

                self._cleanup_stale_buffers(current_track_ids)

                current_time = time.time()
                if current_time - last_refresh_time > 10 and track_data:
                    refresh_ttl(camera_id)
                    last_refresh_time = current_time

                if track_data:
                    payload = {
                        "camera_id": self.camera_id,
                        "location_id": location_id,
                        "timestamp": current_time,
                        "frame_width": meta["new_w"],
                        "frame_height": meta["new_h"],
                        "tracks": track_data
                    }
                    self.publisher.publish("tracking_events", payload)

                # Draw tracking boxes
                frame = draw_tracks(frame, valid_tracks)
        except Exception as e:
            logging.exception("Critical error in process_stream")
            raise Exception(f"Error processing stream {url_rtsp}: {str(e)}")
        finally:
            if self.stream_reader:
                self.stream_reader.stop()
            stop_event.set()
