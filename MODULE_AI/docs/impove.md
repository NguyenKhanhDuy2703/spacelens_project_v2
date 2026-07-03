# SpaceLens MODULE_AI — Phân Tích Chuyên Sâu & Lộ Trình Production

> **Phiên bản:** v1.1.2 | **Phân tích dựa trên:** toàn bộ source code thực tế  
> **Mục tiêu:** Đưa hệ thống từ prototype lên production Edge AI ổn định, hiệu năng cao, scale được.

---

## I. PHÂN TÍCH KIẾN TRÚC HIỆN TẠI — DEEP DIVE

### 1.1 Luồng dữ liệu thực tế (theo code)

```
HTTP POST /api/v1/tracking/process
    └── tracking_router.py: Process(target=run_stream_process)
            └── StreamProcessor.process_stream()
                    ├── StreamReader (thread riêng) ──→ queue.Queue(maxsize=50)
                    │       └── _read_loop: GStreamer fallback → letterbox → put()
                    │
                    ├── ObjectTracking.process_single_frame()
                    │       ├── YOLOv8Model.predict_frame()   ← YOLO OpenVINO
                    │       └── DeepSortModel.tracker_predict() ← CNN feature mỗi frame
                    │
                    ├── Re_ID.get_id_mapping()    ← Redis hget mỗi track
                    ├── Re_ID.check_mapping_re_id() ← Redis hgetall mỗi frame ⚠️
                    ├── ZoneAnalysis.analyze()
                    ├── DwellTimeAnalysis.update_dwell_time()  ← numba JIT
                    ├── HeatmapAnalysis.update_grid_cell()
                    └── PackCommunication.dispatch_payload() → RedisPublisher.publish()
```

### 1.2 Điểm mạnh thực sự trong code

| File | Điểm mạnh | Chi tiết |
|---|---|---|
| `stream_reader.py` | GStreamer auto-detect | `cv2.getBuildInformation()` check, fallback về raw RTSP |
| `stream_reader.py` | Drop-frame queue | `queue.full()` → `get_nowait()` → giữ real-time latency |
| `stream_reader.py` | Letterbox metadata | Trả về `meta` dict đầy đủ ratio/pad cho zone mapping |
| `pack_communication.py` | Throttle thông minh | heatmap 20s, zone_analysis 1s, event không throttle |
| `zone_analysis.py` | Normalized coords | Tự detect 0-1 vs pixel, convert đúng |
| `dwelltime_analysis.py` | Numba JIT | `@jit(nopython=True)` cho `calculate_iou` — đúng hướng |
| `tracking_router.py` | Graceful stop | `_cleanup_process` chạy background thread, không block API |
| `tracking_router.py` | Process isolation | Mỗi camera = 1 `multiprocessing.Process` riêng |


---

## II. BUG & VẤN ĐỀ PHÂN TÍCH THEO TỪNG FILE

### 🔴 BUG #1 — `re_id.py`: 3 Redis connections song song, hgetall mỗi frame

**Code thực tế:**
```python
# app/core/redis.py — connection #1 (module-level singleton, decode_responses=False)
redis_client = Redis(host=..., decode_responses=False)

# app/communication/redis_publish.py — connection #2 (tạo mới mỗi lần __init__)
class RedisPublisher:
    def __init__(self):
        self.redis_client = Redis(host=..., decode_responses=True)  # ← mỗi StreamProcessor tạo 1 cái

# app/core/re_id.py — dùng connection #1
class Re_ID:
    def __init__(self):
        self.redis_client = redis_client  # ← dùng module-level
```

**Vấn đề kép:**
1. `RedisPublisher` tạo connection mới mỗi lần `StreamProcessor.__init__()` → N camera = N connections không được pool
2. `check_mapping_re_id` gọi `hgetall` mỗi frame → nếu có 50 người trong store = 50 vector × 512 bytes = 25KB data transfer qua TCP mỗi frame × 25 FPS = **625KB/s Redis I/O chỉ cho Re-ID**

**Fix:** `RedisManager` singleton pool + in-memory cache (xem Phase 2)

---

### 🔴 BUG #2 — `stream_reader.py`: Không reconnect khi RTSP mất

**Code thực tế:**
```python
while self.running:
    ret, frame = self.cap.read()
    if not ret:
        logging.warning("Failed to read frame. Re-trying shortly...")
        time.sleep(0.1)
        continue  # ← chỉ sleep rồi tiếp tục, KHÔNG tạo lại VideoCapture
```

**Vấn đề:** Khi camera mất kết nối, `cap.read()` sẽ trả về `ret=False` liên tục mãi mãi. `sleep(0.1)` + `continue` không giải quyết được — `VideoCapture` đã ở trạng thái broken, cần `release()` + tạo lại.

**Hệ quả:** Camera mất mạng 5 giây → stream chết vĩnh viễn, phải restart toàn bộ process.

---

### 🔴 BUG #3 — `tracking_router.py`: Không có Watchdog, zombie process risk

**Code thực tế:**
```python
active_processes: dict[str, Process] = {}

@router_tracking.post("/process")
async def process_tracking(request):
    process = Process(target=run_stream_process, args=(...))
    process.start()
    active_processes[clean_url] = process
    # ← Không có gì monitor process này sau khi start
```

**Vấn đề:**
- Process crash do OOM, GPU error, unhandled exception → `active_processes[url].is_alive()` = False nhưng không có ai restart
- Gọi `/process` lại với cùng URL → check `is_alive()` = False → xóa entry → tạo process mới (đúng) nhưng **chỉ khi có request mới** — không tự phục hồi
- `_cleanup_process` dùng `p.join(timeout=10)` → `p.terminate()` → `p.kill()` nhưng không join sau `kill()` đủ lâu → có thể để lại zombie


---

### 🟠 BUG #4 — `stream_processing.py`: Module-level config load tại import time

**Code thực tế:**
```python
# Chạy ngay khi file được import — TRƯỚC khi process con fork
yolo_model_path = settings_dev.read_yaml_config(settings_dev.YOLOV8_CONFIG_PATH)
deepsort_model_path = settings_dev.read_yaml_config(settings_dev.DEEPSORT_CONFIG_PATH)
source_video = settings_dev.VIDEO_SOURCE
```

**Vấn đề:** Trên Windows, `multiprocessing` dùng `spawn` (không phải `fork`). Process con sẽ re-import toàn bộ module → `read_yaml_config` chạy lại → nếu file YAML không tồn tại ở working directory của process con → crash ngay khi start.

**Thêm vào đó:** `DEEPSORT_CONFIG_PATH` vẫn còn trong `config.py` dù đang dùng OpenVINO model cho YOLO — config không đồng bộ với thực tế.

---

### 🟠 BUG #5 — `dwelltime_analysis.py`: `cleanup_old_tracks` tạo ZoneAnalysis mới

**Code thực tế:**
```python
def cleanup_old_tracks(self, max_age=300):
    for track_id in to_delete:
        del self.dwell_times[track_id]
        ZoneAnalysis().cleanup_event_person_zone(track_id)  # ← tạo instance MỚI
```

**Vấn đề:** `ZoneAnalysis()` tạo instance mới với `status_person_run = {}` rỗng → `cleanup_event_person_zone` gọi trên dict rỗng → không xóa được state trong instance `ZoneAnalysis` thực đang chạy trong `StreamProcessor`. **Memory leak** — `zone_analyzer.status_person_run` tích lũy vô hạn.

**Fix:** Truyền `self.zone_analyzer` vào `DwellTimeAnalysis` hoặc gọi cleanup từ `StreamProcessor`.

---

### 🟠 BUG #6 — `heatmap_visualizer.py`: Tạo instance mới mỗi frame

**Code thực tế:**
```python
# stream_processing.py — trong vòng lặp while
heatmap_visualizer_instance = heatmap_visualizer.HeatmapVisualizer().draw_grid(...)
heatmap_overlay = heatmap_visualizer.HeatmapVisualizer().apply_heatmap_overlay(...)
```

**Vấn đề:** 2 object `HeatmapVisualizer` được tạo và hủy mỗi frame × 25 FPS = 50 object allocations/giây. Nhỏ nhưng tích lũy GC pressure. Nên khởi tạo 1 lần trong `__init__`.

---

### 🟡 BUG #7 — `config.py`: `settings_dev` là instance, không phải class

**Code thực tế:**
```python
class settings_dev(settings):
    VIDEO_SOURCE: str = "D:/NCKH_2/MODULE_AI/storage/videos/video_1.mp4"

settings_dev = settings_dev()  # ← ghi đè tên class bằng instance
```

**Vấn đề:** Sau dòng này, `settings_dev` không còn là class nữa — không thể subclass hay mock trong test. Path hardcode `D:/NCKH_2/` sẽ fail trên bất kỳ máy nào khác và trong Docker.

---

### 🟡 BUG #8 — `requirements.txt`: Thiếu `deep_sort_realtime`, `numba`, `scipy`

**Code thực tế trong requirements.txt:**
```
ultralytics
torch
opencv-python>=4.8
OpenVINO
redis
```

**Vấn đề:** `deepsort_model.py` import `deep_sort_realtime` — không có trong requirements. `dwelltime_analysis.py` import `numba` — không có. `re_id.py` import `scipy` — không có. Docker build sẽ fail hoặc cài version không xác định.


---

## III. KIẾN TRÚC ĐỀ XUẤT (TO-BE) — PRODUCTION STACK

```
HTTP API (FastAPI)
    └── tracking_router.py
            └── StreamWatchdog (monitor thread)
                    └── multiprocessing.Process
                            └── StreamProcessor
                                    ├── StreamReader (thread)
                                    │       ├── GStreamer pipeline (RTSP)
                                    │       ├── RTSP retry + exponential backoff
                                    │       └── deque + Condition (không busy-wait)
                                    │
                                    ├── YOLOv8 OpenVINO (đã có weights/)
                                    │       └── model.track(tracker="bytetrack.yaml")
                                    │           ← ByteTrack tích hợp Ultralytics C++
                                    │
                                    ├── ReIDOptimized
                                    │       ├── In-memory dict {id: (vector, timestamp)}
                                    │       ├── cdist vectorized (NumPy/SciPy)
                                    │       └── Write-through Redis (async)
                                    │
                                    ├── ZoneAnalysis (giữ nguyên)
                                    ├── DwellTimeAnalysis (fix cleanup bug)
                                    ├── HeatmapAnalysis (giữ nguyên)
                                    └── PackCommunication → RedisManager pool
```

### So sánh trực tiếp

| Tầng | Hiện tại | Đề xuất | Lợi ích |
|---|---|---|---|
| **Tracking** | DeepSORT — CNN feature mỗi frame | ByteTrack qua `model.track()` | -70% CPU tracking |
| **Re-ID matching** | `hgetall` + Python loop mỗi frame | In-memory `cdist` vectorized | ~80ms → ~2ms |
| **Redis conn** | 3 connections riêng lẻ | 1 ConnectionPool singleton | Không leak socket |
| **RTSP recovery** | `sleep(0.1)` loop mãi | Reconnect + exponential backoff | Tự phục hồi |
| **Process mgmt** | Không có monitor | StreamWatchdog auto-restart | Uptime 24/7 |
| **Frame queue** | `queue.Queue` busy-wait | `deque` + `Condition.wait()` | -30% CPU idle |
| **Config** | Hardcode dev path | `.env` + pydantic Settings | Deploy được |
| **Display** | `cv2.imshow` unconditional | Guard `ENV == "dev"` | Không crash Docker |


---

## IV. LỘ TRÌNH TRIỂN KHAI CHI TIẾT

---

### 🔴 PHASE 1 — STABILITY (Blocker — phải xong trước khi deploy)

#### Task 1.1 — Redis Connection Pool Singleton
**Tạo mới:** `app/core/redis_manager.py`

```python
import redis
from app.config import settings

class RedisManager:
    _pool: redis.ConnectionPool | None = None

    @classmethod
    def get_pool(cls) -> redis.ConnectionPool:
        if cls._pool is None:
            cls._pool = redis.ConnectionPool(
                host=settings.REDIS_HOST,
                port=settings.REDIS_PORT,
                db=settings.REDIS_DB,
                password=settings.REDIS_PASSWORD or None,
                max_connections=20,
                socket_keepalive=True,
                socket_timeout=5.0,
                socket_connect_timeout=3.0,
                retry_on_timeout=True,
                decode_responses=False,  # bytes — Re-ID cần
            )
        return cls._pool

    @classmethod
    def get_client(cls) -> redis.Redis:
        return redis.Redis(connection_pool=cls.get_pool())

    @classmethod
    def get_text_client(cls) -> redis.Redis:
        """decode_responses=True cho RedisPublisher."""
        pool = redis.ConnectionPool(
            host=settings.REDIS_HOST,
            port=settings.REDIS_PORT,
            db=settings.REDIS_DB,
            password=settings.REDIS_PASSWORD or None,
            max_connections=10,
            socket_keepalive=True,
            socket_timeout=5.0,
            retry_on_timeout=True,
            decode_responses=True,
        )
        return redis.Redis(connection_pool=pool)
```

**Cập nhật `redis_publish.py`:** Dùng `RedisManager.get_text_client()` + pipeline + ltrim:
```python
def publish(self, channel: str, message: dict):
    try:
        pipe = self.redis_client.pipeline(transaction=False)
        pipe.lpush(channel, json.dumps(message, ensure_ascii=False))
        pipe.ltrim(channel, 0, 999)  # giới hạn 1000 items, tránh OOM
        pipe.execute()
    except redis.RedisError as e:
        logging.warning(f"[Redis] publish failed on {channel}: {e}")
        # Không raise — Redis lỗi không được crash AI pipeline
```

---

#### Task 1.2 — Fix Config: Tách dev/production, đọc từ .env

**Cập nhật `app/config.py`:**
```python
import os
from pydantic_settings import BaseSettings
import yaml

class Settings(BaseSettings):
    MODULE_NAME: str = "Module AI"
    VERSION: str = "1.1.2"
    ENV: str = "production"          # "dev" | "production"
    APP: str = "cpu"
    YOLOV8_CONFIG_PATH: str = "app/configs/yolov8.config.yaml"
    REDIS_HOST: str = "localhost"
    REDIS_PORT: int = 6379
    REDIS_DB: int = 0
    REDIS_PASSWORD: str = ""
    REDIS_EXPIRE_TIME: int = 3600
    VIDEO_SOURCE: str = ""           # dev only, production dùng API request

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}

    def read_yaml_config(self, path: str) -> dict:
        with open(path, "r", encoding="utf-8") as f:
            return yaml.safe_load(f)

settings = Settings()
```

**Tạo `.env.example`:**
```
ENV=production
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=
```


---

#### Task 1.3 — RTSP Retry + Reconnect trong `_read_loop`

**Tạo mới:** `app/utils/rtsp_retry.py`
```python
import cv2, time, logging

def open_capture_with_retry(source_uri: str, max_retries: int = 5,
                             base_delay: float = 2.0) -> cv2.VideoCapture | None:
    is_rtsp = source_uri.startswith("rtsp://") or source_uri.startswith("rtsps://")
    for attempt in range(max_retries):
        if is_rtsp:
            build_info = cv2.getBuildInformation()
            has_gst = "GStreamer:" in build_info and "YES" in build_info.split("GStreamer:")[1].split("\n")[0]
            if has_gst:
                gst = (f"rtspsrc location={source_uri} latency=100 ! "
                       f"rtph264depay ! h264parse ! decodebin ! "
                       f"videoconvert ! video/x-raw,format=BGR ! appsink drop=true max-buffers=1")
                cap = cv2.VideoCapture(gst, cv2.CAP_GSTREAMER)
                if not cap.isOpened():
                    cap = cv2.VideoCapture(source_uri)
            else:
                cap = cv2.VideoCapture(source_uri)
        else:
            cap = cv2.VideoCapture(source_uri)

        if cap.isOpened():
            ret, frame = cap.read()
            if ret and frame is not None:
                logging.info(f"[RTSP] Connected (attempt {attempt + 1}): {source_uri[:50]}")
                return cap
            cap.release()

        delay = min(base_delay * (2 ** attempt), 60.0)
        logging.warning(f"[RTSP] Attempt {attempt + 1}/{max_retries} failed. Retry in {delay:.0f}s")
        time.sleep(delay)

    logging.error(f"[RTSP] All {max_retries} attempts failed: {source_uri[:50]}")
    return None
```

**Cập nhật `stream_reader.py` — thêm reconnect logic:**
```python
# Trong _read_loop, thay đoạn if not ret:
_fail_count = 0
while self.running:
    ret, frame = self.cap.read()
    if not ret:
        _fail_count += 1
        if _fail_count >= 30:  # ~3 giây liên tiếp fail
            logging.warning("[StreamReader] Stream lost. Attempting reconnect...")
            self.cap.release()
            self.cap = open_capture_with_retry(source_uri)
            if self.cap is None:
                logging.error("[StreamReader] Reconnect failed. Stopping.")
                self.running = False
                break
            _fail_count = 0
        time.sleep(0.1)
        continue
    _fail_count = 0
    # ... xử lý frame bình thường
```

---

#### Task 1.4 — StreamWatchdog

**Tạo mới:** `app/processing/stream_watchdog.py`
```python
import multiprocessing, threading, time, logging

class StreamWatchdog:
    def __init__(self, target_fn, args: tuple, max_restarts: int = 3, delay: float = 5.0):
        self.target_fn = target_fn
        self.args = args
        self.max_restarts = max_restarts
        self.delay = delay
        self._process: multiprocessing.Process | None = None
        self._restart_count = 0
        self._monitor_thread: threading.Thread | None = None
        self._stop_monitor = threading.Event()

    def start(self):
        self._spawn()
        self._monitor_thread = threading.Thread(
            target=self._monitor_loop, daemon=True, name="WatchdogMonitor"
        )
        self._monitor_thread.start()

    def _spawn(self):
        self._process = multiprocessing.Process(
            target=self.target_fn, args=self.args, daemon=True
        )
        self._process.start()
        logging.info(f"[Watchdog] Spawned PID={self._process.pid} (restart #{self._restart_count})")

    def _monitor_loop(self):
        while not self._stop_monitor.is_set():
            time.sleep(5)
            if self._process and not self._process.is_alive():
                exit_code = self._process.exitcode
                if self._restart_count < self.max_restarts:
                    self._restart_count += 1
                    logging.warning(f"[Watchdog] Process died (exit={exit_code}). "
                                    f"Restart {self._restart_count}/{self.max_restarts}")
                    time.sleep(self.delay)
                    self._spawn()
                else:
                    logging.error("[Watchdog] Max restarts reached. Manual intervention required.")
                    self._stop_monitor.set()

    def stop(self):
        self._stop_monitor.set()
        if self._process and self._process.is_alive():
            self._process.terminate()
            self._process.join(timeout=10)
            if self._process.is_alive():
                self._process.kill()
                self._process.join(timeout=3)

    @property
    def is_alive(self) -> bool:
        return self._process is not None and self._process.is_alive()
```

**Cập nhật `tracking_router.py`:** Thay `active_processes: dict[str, Process]` bằng `active_watchdogs: dict[str, StreamWatchdog]`.


---

#### Task 1.5 — Guard `cv2.imshow` + Fix `HeatmapVisualizer` allocation

**Cập nhật `stream_processing.py`:**
```python
from app.config import settings

# Trong __init__:
self.heatmap_viz = heatmap_visualizer.HeatmapVisualizer()  # tạo 1 lần
self._show_window = settings.ENV == "dev"

# Trong vòng lặp while (thay 2 dòng tạo instance mới):
heatmap_grid = self.heatmap_viz.draw_grid(frame.copy(), self.heatmap_analysis.grid_size)
heatmap_overlay = self.heatmap_viz.apply_heatmap_overlay(
    heatmap_grid, self.heatmap_analysis.heatmap_matrix, self.heatmap_analysis.grid_size
)

# Cuối vòng lặp:
if self._show_window:
    cv2.imshow(window_name, heatmap_overlay)
    if cv2.waitKey(25) & 0xFF == ord('q'):
        stop_event.set()
        break
```

---

#### Task 1.6 — Fix `DwellTimeAnalysis.cleanup_old_tracks` memory leak

**Cập nhật `dwelltime_analysis.py`:**
```python
class DwellTimeAnalysis:
    def __init__(self, iou_threshold=0.7, time_threshold=2.0, zone_analyzer=None):
        # ...
        self.zone_analyzer = zone_analyzer  # inject từ StreamProcessor

    def cleanup_old_tracks(self, max_age=300):
        current_time = time.time()
        to_delete = [tid for tid, data in self.dwell_times.items()
                     if current_time - data["last_update"] > max_age]
        for track_id in to_delete:
            del self.dwell_times[track_id]
            if self.zone_analyzer:  # dùng instance thực, không tạo mới
                self.zone_analyzer.cleanup_event_person_zone(track_id)
```

**Cập nhật `stream_processing.py`:**
```python
self.dwell_time_analyzer = DwellTimeAnalysis(
    iou_threshold=0.7,
    time_threshold=3.0,
    zone_analyzer=self.zone_analyzer  # inject
)
```

---

#### Task 1.7 — Health Check thực sự

**Cập nhật `main.py`:**
```python
@router.get("/health", status_code=200)
async def health_check():
    result = {"status": "ok", "redis": "unknown", "version": settings.VERSION}
    try:
        from app.core.redis_manager import RedisManager
        RedisManager.get_client().ping()
        result["redis"] = "connected"
    except Exception as e:
        result["redis"] = f"error: {e}"
        result["status"] = "degraded"
    return result
```

---

#### Task 1.8 — Fix `requirements.txt`

```
# Web API
fastapi==0.111.0
uvicorn[standard]==0.29.0
pydantic==2.7.1
pydantic-settings==2.2.1
python-multipart==0.0.9

# AI & Vision
ultralytics==8.2.0
torch==2.3.0+cpu --index-url https://download.pytorch.org/whl/cpu
torchvision==0.18.0+cpu --index-url https://download.pytorch.org/whl/cpu
opencv-python-headless==4.9.0.80
openvino==2024.1.0

# Analytics
numpy==1.26.4
scipy==1.13.0
numba==0.59.1

# Tracking (legacy — xóa sau khi chuyển ByteTrack)
deep-sort-realtime==1.3.2

# Infrastructure
redis==5.0.4
pyyaml==6.0.1
python-dotenv==1.0.1
```


---

### 🟠 PHASE 2 — PERFORMANCE (Tối ưu FPS & CPU)

#### Task 2.1 — ByteTrack thay DeepSORT (tích hợp Ultralytics)

**Lý do chọn Ultralytics ByteTrack thay vì tự implement:**
- ByteTrack đã được tích hợp sẵn trong Ultralytics, chạy ở tầng C++ — không cần thêm dependency
- `model.track()` trả về `Results` object với `.boxes.id` — tương thích với code hiện tại
- Không cần `tranform_detections()` nữa — YOLO + ByteTrack xử lý trong 1 call

**Cập nhật `yolov8_model.py`:**
```python
from ultralytics import YOLO

class YOLOv8Model:
    def __init__(self, config: dict):
        model_path = config['yolov8']['model_path']
        self.conf_threshold = config['yolov8']['confidence_threshold']
        self.iou_threshold = config['yolov8']['iou_threshold']
        self.classes = config['yolov8']['classes']
        self.model = YOLO(model_path)

    def predict_frame(self, frame):
        """Detect only — dùng cho batch inference Phase 3."""
        return self.model(frame, conf=self.conf_threshold,
                          classes=self.classes, iou=self.iou_threshold, verbose=False)

    def track_frame(self, frame):
        """Detect + ByteTrack — dùng cho single stream."""
        return self.model.track(
            frame,
            conf=self.conf_threshold,
            classes=self.classes,
            iou=self.iou_threshold,
            tracker="bytetrack.yaml",
            persist=True,   # giữ track state giữa các frame
            verbose=False,
        )
```

**Cập nhật `object_tracking.py`:**
```python
class ObjectTracking:
    def __init__(self, config: dict):
        self.yolo_model = YOLOv8Model(config["yolov8_config_path"])
        # Xóa DeepSortModel

    def process_single_frame(self, frame) -> list:
        """Trả về list (track_id, x1, y1, x2, y2, conf) từ ByteTrack."""
        results = self.yolo_model.track_frame(frame)
        tracks = []
        if results and results[0].boxes.id is not None:
            boxes = results[0].boxes
            for i in range(len(boxes)):
                track_id = int(boxes.id[i].item())
                x1, y1, x2, y2 = map(int, boxes.xyxy[i].tolist())
                conf = float(boxes.conf[i].item())
                tracks.append({"track_id": track_id, "bbox": [x1, y1, x2, y2], "conf": conf})
        return tracks
```

**Lưu ý quan trọng:** ByteTrack không có `track.features` như DeepSORT → Re-ID cần dùng OSNet crop riêng (Phase 2.2). Trong giai đoạn chuyển tiếp, có thể bỏ Re-ID feature matching, chỉ dùng ByteTrack ID.

---

#### Task 2.2 — Re-ID In-memory Vectorized

**Tạo mới:** `app/core/re_id_optimized.py`
```python
import numpy as np
from scipy.spatial.distance import cdist
import threading, time, logging
from app.core.redis_manager import RedisManager

class ReIDOptimized:
    def __init__(self, camera_id: str, threshold: float = 0.25, ttl: int = 300):
        self.camera_id = camera_id
        self.threshold = threshold
        self.ttl = ttl
        self._redis = RedisManager.get_client()
        self._lock = threading.RLock()
        # {final_id: (feature_np_float32, last_seen_timestamp)}
        self._cache: dict[str, tuple[np.ndarray, float]] = {}
        self._load_from_redis()  # warm-up từ Redis khi khởi động

    def _load_from_redis(self):
        """Tải toàn bộ feature từ Redis vào RAM khi khởi động."""
        try:
            hash_name = f"re_id_feature:{self.camera_id}"
            all_data = self._redis.hgetall(hash_name)
            with self._lock:
                for fid_bytes, vec_bytes in all_data.items():
                    fid = fid_bytes.decode() if isinstance(fid_bytes, bytes) else fid_bytes
                    vec = np.frombuffer(vec_bytes, dtype=np.float32).copy()
                    self._cache[fid] = (vec, time.time())
            logging.info(f"[ReID] Loaded {len(self._cache)} features from Redis for {self.camera_id}")
        except Exception as e:
            logging.warning(f"[ReID] Redis warm-up failed: {e}")

    def _evict_expired(self):
        now = time.time()
        expired = [k for k, (_, ts) in self._cache.items() if now - ts > self.ttl]
        for k in expired:
            del self._cache[k]

    def match(self, feature: np.ndarray) -> tuple[bool, str | None]:
        """Vectorized cosine matching — O(N) trên NumPy C layer."""
        feature = feature.astype(np.float32)
        with self._lock:
            self._evict_expired()
            if not self._cache:
                return False, None
            ids = list(self._cache.keys())
            matrix = np.stack([self._cache[i][0] for i in ids])
            dists = cdist([feature], matrix, metric='cosine')[0]
            min_idx = int(np.argmin(dists))
            if dists[min_idx] < self.threshold:
                matched_id = ids[min_idx]
                self._cache[matched_id] = (self._cache[matched_id][0], time.time())  # refresh TTL
                return True, matched_id
        return False, None

    def store(self, final_id: str, feature: np.ndarray):
        """Lưu vào RAM + write-through Redis."""
        feature = feature.astype(np.float32)
        with self._lock:
            self._cache[final_id] = (feature, time.time())
        try:
            hash_name = f"re_id_feature:{self.camera_id}"
            self._redis.hset(hash_name, final_id, feature.tobytes())
            self._redis.expire(hash_name, 3600)
        except Exception as e:
            logging.warning(f"[ReID] Redis write-through failed: {e}")
```


---

#### Task 2.3 — Condition Variable thay Busy-wait trong StreamReader

**Vấn đề hiện tại:** `stream_processing.py` gọi `get_frame(timeout=0.01)` trong vòng lặp → CPU spin 100 lần/giây khi queue trống.

**Cập nhật `stream_reader.py`:**
```python
from collections import deque
import threading

class StreamReader:
    def __init__(self, target_size=(640, 640), queue_size=50):
        self.target_size = target_size
        self._deque = deque(maxlen=queue_size)
        self._cond = threading.Condition(threading.Lock())
        self.running = False
        self.read_thread = None

    def _put_frame(self, frame, meta):
        with self._cond:
            self._deque.append((frame, meta))
            self._cond.notify()  # đánh thức consumer

    def get_frame(self, timeout: float = 1.0):
        with self._cond:
            if not self._deque:
                self._cond.wait(timeout=timeout)  # sleep thực sự, không spin
            if self._deque:
                return self._deque.popleft()
        return None, None
```

---

#### Task 2.4 — OSNet Re-ID (On-demand feature extraction)

**Tạo mới:** `app/core/osnet_reid.py`
```python
import cv2
import numpy as np
from openvino.runtime import Core

class OSNetReID:
    """
    Trích xuất feature vector 512-dim từ crop ảnh người dùng OSNet OpenVINO.
    Chỉ gọi khi track mới được confirm — không chạy mỗi frame.
    """
    INPUT_SIZE = (256, 128)  # OSNet standard: H=256, W=128

    def __init__(self, model_xml: str):
        ie = Core()
        model = ie.read_model(model_xml)
        self.compiled = ie.compile_model(model, "CPU")
        self.input_layer = self.compiled.input(0)
        self.output_layer = self.compiled.output(0)

    def extract(self, frame: np.ndarray, bbox: list[int]) -> np.ndarray | None:
        """
        frame: BGR frame gốc (640x640 letterbox)
        bbox: [x1, y1, x2, y2]
        """
        x1, y1, x2, y2 = bbox
        if x2 <= x1 or y2 <= y1:
            return None
        crop = frame[y1:y2, x1:x2]
        if crop.size == 0:
            return None

        # Preprocess: resize → normalize → NCHW
        crop = cv2.resize(crop, (self.INPUT_SIZE[1], self.INPUT_SIZE[0]))
        crop = crop.astype(np.float32) / 255.0
        mean = np.array([0.485, 0.456, 0.406], dtype=np.float32)
        std  = np.array([0.229, 0.224, 0.225], dtype=np.float32)
        crop = (crop - mean) / std
        blob = crop.transpose(2, 0, 1)[np.newaxis]  # (1, 3, 256, 128)

        result = self.compiled({self.input_layer: blob})[self.output_layer]
        feature = result[0]
        # L2 normalize
        norm = np.linalg.norm(feature)
        return feature / norm if norm > 0 else feature
```

**Tích hợp vào `stream_processing.py`:**
```python
# Chỉ extract feature khi track mới xuất hiện lần đầu
if final_track_id not in self._reid_extracted:
    feature = self.osnet.extract(frame, [x1, y1, x2, y2])
    if feature is not None:
        matched, matched_id = self.re_id.match(feature)
        if matched:
            final_track_id = matched_id
        else:
            self.re_id.store(final_track_id, feature)
        self._reid_extracted.add(final_track_id)
```


---

### 🟢 PHASE 3 — SCALE (Đa camera, Edge optimization)

#### Task 3.1 — Dockerfile Multi-stage Production

```dockerfile
# ── Stage 1: Builder ──────────────────────────────────────────
FROM python:3.10-slim AS builder
WORKDIR /build

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential cmake git libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

# ── Stage 2: Runtime ─────────────────────────────────────────
FROM python:3.10-slim AS runtime
WORKDIR /app

# GStreamer runtime (cần cho RTSP decode)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgstreamer1.0-0 \
    gstreamer1.0-plugins-base \
    gstreamer1.0-plugins-good \
    gstreamer1.0-plugins-bad \
    gstreamer1.0-libav \
    libgl1-mesa-glx \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /install /usr/local
COPY . .

# Non-root user
RUN useradd -m -u 1000 aiuser && chown -R aiuser:aiuser /app
USER aiuser

ENV ENV=production
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1

EXPOSE 8000
CMD ["python", "run.py"]
```

---

#### Task 3.2 — docker-compose.yml Production

```yaml
version: "3.9"

services:
  redis:
    image: redis:7-alpine
    command: >
      redis-server
      --maxmemory 512mb
      --maxmemory-policy allkeys-lru
      --save ""
      --appendonly no
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 3s
      retries: 5
    deploy:
      resources:
        limits:
          memory: 600m

  ai_module:
    build: .
    restart: unless-stopped
    env_file: .env
    depends_on:
      redis:
        condition: service_healthy
    ports:
      - "8000:8000"
    volumes:
      - ./weights:/app/weights:ro
      - ./storage:/app/storage:ro
      - ./logs:/app/logs
    environment:
      - REDIS_HOST=redis
      - ENV=production
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/api/v1/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 60s
    deploy:
      resources:
        limits:
          cpus: "3.0"
          memory: 3g
        reservations:
          memory: 1g
```

---

#### Task 3.3 — OpenVINO INT8 Export (đã có weights sẵn)

```bash
# Đã có: weights/yolov8m_openvino_model/ (xml + bin)
# Chỉ cần verify và dùng — không cần export lại

# Nếu cần export lại với INT8:
yolo export model=weights/yolov8m.pt format=openvino int8=True

# Export OSNet sang OpenVINO (cần file .pth hoặc .onnx):
# Bước 1: PyTorch → ONNX
python -c "
import torch
model = torch.load('weights/osnet_x0_25.pth')
dummy = torch.randn(1, 3, 256, 128)
torch.onnx.export(model, dummy, 'weights/osnet.onnx', opset_version=11)
"
# Bước 2: ONNX → OpenVINO IR
mo --input_model weights/osnet.onnx --output_dir weights/osnet_openvino/
```

---

#### Task 3.4 — Prometheus Metrics

**Tạo mới:** `app/utils/metrics.py`
```python
from prometheus_client import Counter, Gauge, Histogram, start_http_server
import functools, time

fps_gauge        = Gauge("ai_fps",              "FPS per camera",        ["camera_id"])
track_gauge      = Gauge("ai_active_tracks",    "Active tracks",         ["camera_id"])
reid_latency     = Histogram("ai_reid_ms",      "Re-ID latency ms",      ["camera_id"])
redis_errors     = Counter("ai_redis_errors",   "Redis error count",     ["camera_id"])
frame_drops      = Counter("ai_frame_drops",    "Dropped frames",        ["camera_id"])
process_restarts = Counter("ai_restarts",       "Watchdog restarts",     ["camera_id"])

def start_metrics_server(port: int = 8001):
    start_http_server(port)
    import logging
    logging.info(f"[Metrics] Prometheus server started on :{port}")
```


---

## V. CHECKLIST PRODUCTION READINESS

### 🔴 Phải xong trước khi deploy (Phase 1)

- [ ] **1.1** Tạo `app/core/redis_manager.py` — ConnectionPool singleton
- [ ] **1.1** Cập nhật `redis_publish.py` — dùng pool + pipeline + ltrim
- [ ] **1.1** Cập nhật `app/core/redis.py` — dùng RedisManager
- [ ] **1.1** Cập nhật `re_id.py` — dùng RedisManager
- [ ] **1.2** Cập nhật `config.py` — tách Settings, đọc từ `.env`
- [ ] **1.2** Tạo `.env.example`
- [ ] **1.3** Tạo `app/utils/rtsp_retry.py`
- [ ] **1.3** Cập nhật `stream_reader.py` — reconnect khi `ret=False` liên tiếp
- [ ] **1.4** Tạo `app/processing/stream_watchdog.py`
- [ ] **1.4** Cập nhật `tracking_router.py` — dùng StreamWatchdog
- [ ] **1.5** Cập nhật `stream_processing.py` — guard `cv2.imshow`, fix HeatmapVisualizer
- [ ] **1.6** Fix `dwelltime_analysis.py` — inject zone_analyzer, không tạo instance mới
- [ ] **1.7** Cập nhật `main.py` — health check kiểm tra Redis thực sự
- [ ] **1.8** Fix `requirements.txt` — pin versions, thêm missing deps, headless opencv

### 🟠 Tối ưu hiệu năng (Phase 2)

- [ ] **2.1** Cập nhật `yolov8_model.py` — thêm `track_frame()` với ByteTrack
- [ ] **2.1** Cập nhật `object_tracking.py` — xóa DeepSORT, dùng ByteTrack
- [ ] **2.2** Tạo `app/core/re_id_optimized.py` — in-memory vectorized
- [ ] **2.2** Cập nhật `stream_processing.py` — dùng ReIDOptimized
- [ ] **2.3** Cập nhật `stream_reader.py` — Condition Variable
- [ ] **2.4** Tạo `app/core/osnet_reid.py` — on-demand feature extraction
- [ ] **2.4** Download/convert OSNet model sang OpenVINO IR

### 🟢 Scale & Monitoring (Phase 3)

- [ ] **3.1** Viết `Dockerfile` multi-stage với GStreamer runtime
- [ ] **3.2** Viết `docker-compose.yml` với resource limits + healthcheck
- [ ] **3.3** Verify/export OpenVINO INT8 models
- [ ] **3.4** Tạo `app/utils/metrics.py` — Prometheus
- [ ] **3.4** Tích hợp metrics vào `stream_processing.py` và `stream_watchdog.py`

---

## VI. CẤU TRÚC FILE SAU KHI HOÀN THÀNH

```
app/
├── core/
│   ├── redis_manager.py      ← MỚI: Pool singleton (bytes + text client)
│   ├── re_id_optimized.py    ← MỚI: In-memory vectorized + Redis warm-up
│   ├── osnet_reid.py         ← MỚI: OpenVINO OSNet feature extractor
│   ├── yolov8_model.py       ← CẬP NHẬT: track_frame() + ByteTrack
│   ├── object_tracking.py    ← CẬP NHẬT: xóa DeepSORT
│   ├── redis.py              ← CẬP NHẬT: dùng RedisManager
│   └── re_id.py              ← GIỮ (legacy, thay dần bằng re_id_optimized)
├── processing/
│   ├── stream_watchdog.py    ← MỚI: Process supervisor + auto-restart
│   ├── stream_reader.py      ← CẬP NHẬT: Condition var + reconnect loop
│   └── stream_processing.py  ← CẬP NHẬT: guard imshow, fix alloc, ReIDOptimized
├── analytics/
│   ├── dwelltime_analysis.py ← CẬP NHẬT: inject zone_analyzer, fix memory leak
│   ├── zone_analysis.py      ← GIỮ NGUYÊN (đã tốt)
│   └── heatmap_analysis.py   ← GIỮ NGUYÊN (đã tốt)
├── api/v1/
│   └── tracking_router.py    ← CẬP NHẬT: dùng StreamWatchdog
├── communication/
│   └── redis_publish.py      ← CẬP NHẬT: pool + pipeline + ltrim
├── utils/
│   ├── rtsp_retry.py         ← MỚI: Exponential backoff reconnect
│   └── metrics.py            ← MỚI (Phase 3): Prometheus
├── config.py                 ← CẬP NHẬT: Settings từ .env
└── main.py                   ← CẬP NHẬT: health check thực sự
```

---

## VII. KỲ VỌNG HIỆU NĂNG

| Metric | Hiện tại | Sau Phase 1 | Sau Phase 2 | Sau Phase 3 |
|---|---|---|---|---|
| FPS (1 camera, CPU) | ~8-12 | ~12-15 | ~22-28 | ~30+ |
| Re-ID latency/frame | ~80ms | ~80ms | ~2ms | ~1ms |
| CPU idle (no frame) | ~15% spin | ~15% spin | ~2% sleep | ~2% sleep |
| RAM (1 camera) | ~1.2GB | ~1.0GB | ~800MB | ~600MB |
| Docker image | ~5GB | ~1.5GB | ~1.5GB | ~1.5GB |
| Uptime (24h) | Không đảm bảo | 99%+ | 99%+ | 99.9%+ |
| Camera đồng thời | 1 | 1-2 | 2-3 | 3-4 |
| RTSP recovery | Không | Tự động | Tự động | Tự động |
| Redis crash | App crash | Degraded gracefully | Degraded gracefully | Degraded gracefully |
