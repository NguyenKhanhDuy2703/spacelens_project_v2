import numpy as np
import cv2

class ZoneAnalysis:
    def __init__(self):
        self.status_person_run = {}

    def _to_pixel_points(self, points, frame_w: int, frame_h: int):
        """Convert points to absolute pixel coords.
        If all values are in [0, 1] → treat as normalized ratios and scale up.
        Otherwise → already absolute pixels, cast to int.
        """
        if not points:
            return points
        flat = [v for pair in points for v in pair]
        is_normalized = all(0.0 <= v <= 1.0 for v in flat)
        if is_normalized and frame_w > 0 and frame_h > 0:
            return [[int(x * frame_w), int(y * frame_h)] for x, y in points]
        return [[int(x), int(y)] for x, y in points]

    def pointpolygon(self, point, polygon_points):
        pt = (float(point[0]), float(point[1]))
        contour = np.array(polygon_points, dtype=np.int32).reshape((-1, 1, 2))
        return cv2.pointPolygonTest(contour, pt, False) >= 0

    def analyze(self, point, list_zones, track_id=None, frame_w: int = 0, frame_h: int = 0):
        hit_zones = []
        events = []
        if not list_zones or track_id is None:
            return hit_zones, events

        current_zone_id = "OUTSIDE"
        for zone in list_zones:
            points = zone.get("points") if isinstance(zone, dict) else getattr(zone, "points", None)
            zone_id = None
            if isinstance(zone, dict):
                zone_id = zone.get("zone_id", "unknown")
            else:
                zone_id = getattr(zone, "zone_id", "unknown")

            if points:
                pixel_points = self._to_pixel_points(points, frame_w, frame_h)
                if self.pointpolygon(point, pixel_points):
                    current_zone_id = zone_id
                    hit_zones.append(zone_id)
                    break

        last_zone_id = self.status_person_run.get(track_id, "OUTSIDE")

        if current_zone_id != last_zone_id:
            if last_zone_id == "OUTSIDE" and current_zone_id != "OUTSIDE":
                events.append({"track_id": track_id, "zone_id": current_zone_id, "event": "ENTRY"})
            elif last_zone_id != "OUTSIDE" and current_zone_id == "OUTSIDE":
                events.append({"track_id": track_id, "zone_id": last_zone_id, "event": "EXIT"})
            elif last_zone_id != "OUTSIDE" and current_zone_id != "OUTSIDE":
                events.append({
                    "track_id": track_id,
                    "from_zone_id": last_zone_id,
                    "to_zone_id": current_zone_id,
                    "event": "TRANSITION",
                })
            self.status_person_run[track_id] = current_zone_id

        return hit_zones, events

    def cleanup_event_person_zone(self, track_id):
        if track_id in self.status_person_run:
            del self.status_person_run[track_id]

    def draw_zones(self, frame, list_zones, frame_w: int = 0, frame_h: int = 0):
        if list_zones is None or frame is None:
            return frame

        for zone in list_zones:
            points = zone.get("points") if isinstance(zone, dict) else getattr(zone, "points", None)
            zone_id = zone.get("zone_id", "unknown") if isinstance(zone, dict) else getattr(zone, "zone_id", "unknown")
            if not points:
                continue

            pixel_points = self._to_pixel_points(points, frame_w, frame_h)
            contour = np.array(pixel_points, dtype=np.int32).reshape((-1, 1, 2))
            cv2.polylines(frame, [contour], isClosed=True, color=(255, 255, 0), thickness=2)
            cv2.putText(
                frame,
                zone_id,
                (int(contour[0][0][0]), int(contour[0][0][1]) - 10),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.6,
                (255, 255, 0),
                2,
            )
        return frame