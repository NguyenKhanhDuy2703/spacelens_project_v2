import time
import logging
import cv2

def handle_reconnect(
    is_rtsp: bool,
    input_source: str,
    fail_count: int,
    backoff: float,
    cap: cv2.VideoCapture | None,
    open_capture_fn,
    get_video_fps_fn
) -> tuple:
    """
    Xử lý mất kết nối luồng RTSP và tự động kết nối lại (hoặc dừng nếu là file video).
    
    Returns:
        tuple: (success: bool, fail_count: int, backoff: float, frame_interval: float, new_cap: VideoCapture|None)
    """
    fail_count += 1

    if not is_rtsp:
        logging.info("[StreamReader] Video EOF reached. Stopping stream.")
        return False, fail_count, backoff, 0.0, None

    if fail_count < 5:
        logging.warning(f"[StreamReader] Read failed ({fail_count}/5). Retrying...")
        time.sleep(0.1)
        return True, fail_count, backoff, 0.0, cap

    logging.warning(f"[StreamReader] Stream lost. Reconnecting in {backoff:.0f}s...")
    if cap:
        cap.release()
    time.sleep(backoff)
    new_backoff = min(backoff * 2, 60.0)

    new_cap = open_capture_fn(input_source)
    if new_cap is None:
        logging.error("[StreamReader] Reconnect failed. Stopping.")
        return False, fail_count, new_backoff, 0.0, None

    fps = get_video_fps_fn(new_cap)
    new_frame_interval = 1.0 / fps
    logging.info("[StreamReader] Reconnected successfully.")
    return True, 0, 2.0, new_frame_interval, new_cap
