import threading
import logging
import time
import os
import cv2
import numpy as np
from collections import deque
from app.utils.path_utils import resolve_path
from app.utils.connection_utils import handle_reconnect
from app.utils.image_utils import letterbox


class StreamReader:
    def __init__(self, target_size: tuple = (640, 640), queue_size: int = 4):
        self.target_size = target_size
        self.queue_size = queue_size
        self._deque: deque = deque(maxlen=queue_size)
        self._cond = threading.Condition(threading.Lock())

        self.cap: cv2.VideoCapture | None = None
        self.running = False
        self._read_thread: threading.Thread | None = None
        self._is_rtsp = False

    def start_read(self, source_uri: str) -> None:
        if not source_uri:
            raise ValueError("source_uri is required.")
        self._is_rtsp = source_uri.startswith("rtsp://") or source_uri.startswith("rtsps://")
        self.running = True
        self._read_thread = threading.Thread(
            target=self._read_loop,
            args=(source_uri,),
            name=f"StreamReader-{source_uri[:30]}",
            daemon=True,
        )
        self._read_thread.start()
        logging.info(f"[StreamReader] Thread started: {source_uri[:60]}")

    def get_frame(self, timeout: float = 1.0) -> tuple:
        with self._cond:
            if not self._deque:
                self._cond.wait(timeout=timeout)
            if self._deque:
                return self._deque.popleft()
        return None, None

    def stop(self) -> None:
        self.running = False
        with self._cond:
            self._cond.notify_all()
        if self._read_thread:
            self._read_thread.join(timeout=5)
        self._drain_deque()
        logging.info("[StreamReader] Stopped and deque cleared.")

    def _open_capture(self, source_uri: str) -> cv2.VideoCapture | None:

        if not self._is_rtsp:
            cap = cv2.VideoCapture(source_uri)
            if cap.isOpened():
                return cap
            logging.error(f"[StreamReader] Cannot open file: {source_uri}")
            return None

        # RTSP: thử GStreamer trước
        build_info = cv2.getBuildInformation()
        has_gst = (
            "GStreamer:" in build_info
            and "YES" in build_info.split("GStreamer:")[1].split("\n")[0]
        )
        if has_gst:
            gst = (
                f"rtspsrc location={source_uri} latency=100 ! "
                f"rtph264depay ! h264parse ! decodebin ! "
                f"videoconvert ! video/x-raw,format=BGR ! "
                f"appsink drop=true max-buffers=1"
            )
            cap = cv2.VideoCapture(gst, cv2.CAP_GSTREAMER)
            if cap.isOpened():
                logging.info("[StreamReader] GStreamer pipeline opened.")
                return cap
            logging.warning("[StreamReader] GStreamer failed, falling back to default.")

        cap = cv2.VideoCapture(source_uri)
        if cap.isOpened():
            return cap
        logging.error(f"[StreamReader] Cannot open RTSP: {source_uri}")
        return None

    def _get_video_fps(self, cap=None) -> float:
        c = cap if cap is not None else self.cap
        if c is None:
            return 30.0
        fps = c.get(cv2.CAP_PROP_FPS)
        return fps if fps and fps > 0 else 30.0

    def _push_frame(self, frame: np.ndarray, meta: dict) -> None:
        with self._cond:
            self._deque.append((frame, meta))
            self._cond.notify()

    def _drain_deque(self) -> None:
        with self._cond:
            self._deque.clear()

    def _read_loop(self, source_uri: str) -> None:
        input_source = resolve_path(source_uri, self._is_rtsp)
        self.cap = self._open_capture(input_source)

        if self.cap is None:
            self.running = False
            with self._cond:
                self._cond.notify_all()
            return

        fps = self._get_video_fps()
        frame_interval = 1.0 / fps  
        logging.info(
            f"[StreamReader] Source FPS={fps:.1f}, "
            f"interval={frame_interval*1000:.1f}ms, "
            f"queue_size={self.queue_size}"
        )

        _fail_count = 0
        _backoff = 2.0  

        while self.running:
            t_start = time.monotonic()
            ret, frame = self.cap.read()

            if not ret:
                success, _fail_count, _backoff, new_interval, new_cap = handle_reconnect(
                    self._is_rtsp,
                    input_source,
                    _fail_count,
                    _backoff,
                    self.cap,
                    self._open_capture,
                    self._get_video_fps
                )
                self.cap = new_cap
                if not success:
                    self.running = False
                    break
                if new_interval > 0:
                    frame_interval = new_interval
                continue

            _fail_count = 0
            processed, meta = letterbox(frame, self.target_size)
            if processed is not None:
                self._push_frame(processed, meta)

            self._throttle_file(t_start, frame_interval)

        self._release_resources(source_uri)



    def _throttle_file(self, t_start: float, frame_interval: float) -> None:
        if not self._is_rtsp:
            elapsed = time.monotonic() - t_start
            sleep_time = frame_interval - elapsed
            if sleep_time > 0:
                time.sleep(sleep_time)

    def _release_resources(self, source_uri: str) -> None:
        if self.cap:
            self.cap.release()
            self.cap = None
            logging.info(f"[StreamReader] Capture released: {source_uri[:60]}")

        with self._cond:
            self._cond.notify_all()

