import cv2
import numpy as np

def letterbox(
    frame: np.ndarray,
    target_size: tuple = (640, 640),
    color: tuple = (114, 114, 114),
) -> tuple:

    if frame is None:
        return None, None

    h, w = frame.shape[:2]

    # Scale ratio
    r = min(target_size[0] / h, target_size[1] / w)

    # Kích thước sau resize
    new_w = int(round(w * r))
    new_h = int(round(h * r))

    # Padding
    dw = (target_size[1] - new_w) / 2
    dh = (target_size[0] - new_h) / 2
    top    = int(round(dh - 0.1))
    bottom = int(round(dh + 0.1))
    left   = int(round(dw - 0.1))
    right  = int(round(dw + 0.1))

    if (w, h) != (new_w, new_h):
        frame = cv2.resize(frame, (new_w, new_h), interpolation=cv2.INTER_LINEAR)

    frame = cv2.copyMakeBorder(
        frame, top, bottom, left, right,
        cv2.BORDER_CONSTANT, value=color
    )

    meta = {
        "original_w": w,
        "original_h": h,
        "scale":      r,     
        "ratio_w":    r,     
        "ratio_h":    r,
        "pad_left":   left,
        "pad_top":    top,
        "new_w":      frame.shape[1],
        "new_h":      frame.shape[0],
    }
    return frame, meta


def map_zone_points_to_letterbox(list_zone: list, meta: dict) -> list:
    """Ánh xạ tọa độ polygon của các Zone từ ảnh gốc sang không gian tọa độ ảnh Letterbox."""
    if not list_zone or not meta:
        return list_zone

    original_w = meta["original_w"]
    original_h = meta["original_h"]
    ratio_w    = meta["ratio_w"]
    ratio_h    = meta["ratio_h"]
    pad_left   = meta["pad_left"]
    pad_top    = meta["pad_top"]

    mapped_zones = []
    for zone in list_zone:
        points  = zone.get("points") if isinstance(zone, dict) else getattr(zone, "points", None)
        zone_id = zone.get("zone_id", "unknown") if isinstance(zone, dict) else getattr(zone, "zone_id", "unknown")
        if not points:
            mapped_zones.append({"zone_id": zone_id, "points": []})
            continue

        flat = [v for pair in points for v in pair]
        is_normalized = all(0.0 <= v <= 1.0 for v in flat)

        mapped_points = []
        for x, y in points:
            px = x * original_w if is_normalized else x
            py = y * original_h if is_normalized else y
            lx = int(px * ratio_w + pad_left)
            ly = int(py * ratio_h + pad_top)
            mapped_points.append([lx, ly])

        mapped_zones.append({"zone_id": zone_id, "points": mapped_points})
    return mapped_zones
