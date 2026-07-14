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
