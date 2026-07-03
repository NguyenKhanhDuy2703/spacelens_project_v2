# Code Audit — SpaceLens MODULE_AI

> **Phạm vi:** Toàn bộ source code v1.1.2  
> **Phương pháp:** Đọc từng dòng, trace luồng dữ liệu, phân tích runtime behavior  
> **Phân loại:** 🔴 Bug (sai logic/crash) · 🟠 Chưa hợp lý (design flaw) · 🟡 Chưa tối ưu (perf/quality)

---

## MỤC LỤC

1. [config.py](#1-configpy)
2. [core/redis.py](#2-coreredis-py)
3. [core/re_id.py](#3-corere_idpy)
4. [core/deepsort_model.py](#4-coredeepsort_modelpy)
5. [core/object_tracking.py](#5-coreobject_trackingpy)
6. [core/yolov8_model.py](#6-coreyolov8_modelpy)
7. [processing/stream_reader.py](#7-processingstream_readerpy)
8. [processing/stream_processing.py](#8-processingstream_processingpy)
9. [analytics/dwelltime_analysis.py](#9-analyticsdwelltime_analysispy)
10. [analytics/zone_analysis.py](#10-analyticszone_analysispy)
11. [analytics/heatmap_analysis.py](#11-analyticsheatmap_analysispy)
12. [communication/redis_publish.py](#12-communicationredis_publishpy)
13. [communication/pack_communication.py](#13-communicationpack_communicationpy)
14. [api/v1/tracking_router.py](#14-apiv1tracking_routerpy)
15. [main.py](#15-mainpy)
16. [run.py](#16-runpy)
17. [requirements.txt](#17-requirementstxt)
18. [Tổng hợp theo mức độ](#18-tổng-hợp-theo-mức-độ)

---

## 1. `config.py`

### 🔴 BUG-01 — Class name bị ghi đè bởi instance

```python
class settings_dev(settings):
    VIDEO_SOURCE: str = "D:/NCKH_2/MODULE_AI/storage/videos/video_1.mp4"

settings_dev = settings_dev()  # ← ghi đè tên class bằng instance
```

**Hậu quả:** Sau dòng này `settings_dev` không còn là class. Không thể subclass, không thể mock trong test, không thể `isinstance()`. Nếu bất kỳ module nào import `settings_dev` rồi cố gọi `settings_dev(...)` lần nữa → `TypeError: 'settings_dev' object is not callable`.

**Fix:**
```python
class DevSettings(Settings):
    VIDEO_SOURCE: str = "storage/videos/video_1.mp4"

settings = DevSettings()
```

---

### 🔴 BUG-02 — `VIDEO_SOURCE` hardcode đường dẫn tuyệt đối máy dev

```python
VIDEO_SOURCE: str = "D:/NCKH_2/MODULE_AI/storage/videos/video_1.mp4"
```

**Hậu quả:** Fail ngay trên bất kỳ máy nào khác, trong Docker, hoặc CI/CD. Path này còn bị load ở module-level trong `stream_processing.py` → crash khi import.

---

### 🟠 DESIGN-01 — Không có environment separation

Không có `ENV` flag, không đọc từ `.env`, không có `settings_prod`. Toàn bộ codebase dùng `settings_dev` kể cả khi deploy production. Không có cách nào override config mà không sửa code.

---

### 🟠 DESIGN-02 — `DEEPSORT_CONFIG_PATH` còn trong base class

```python
DEEPSORT_CONFIG_PATH: str = "app/configs/deepsort.config.yaml"
```

Config này vẫn tồn tại dù hệ thống đang dùng OpenVINO model cho YOLO. Gây nhầm lẫn về trạng thái thực của hệ thống.

---

### 🟡 OPT-01 — `read_yaml_config` không cache

Mỗi lần gọi đều mở file và parse YAML. Trong `stream_processing.py` gọi 2 lần ở module-level. Nên cache kết quả với `functools.lru_cache`.


---

## 2. `core/redis.py`

### 🔴 BUG-03 — `encoding='utf-8'` không phải tham số hợp lệ của `redis.Redis`

```python
redis_client = Redis(
    host=settings_dev.REDIS_HOST,
    db=0,
    decode_responses=False,
    encoding='utf-8'   # ← không có tham số này trong redis-py >= 4.x
)
```

**Hậu quả:** `redis-py >= 4.0` đã bỏ tham số `encoding`. Sẽ raise `TypeError: __init__() got an unexpected keyword argument 'encoding'` khi khởi động.

**Fix:** Xóa `encoding='utf-8'`.

---

### 🟠 DESIGN-03 — Module-level singleton không dùng connection pool

```python
# Module-level — chạy khi import, tạo 1 connection đơn lẻ
redis_client = Redis(host=..., decode_responses=False)
```

Đây là bare connection, không phải pool. Nếu connection bị drop (Redis restart, network timeout), `redis_client` sẽ ở trạng thái broken mãi mãi cho đến khi process restart. Không có `retry_on_timeout`, không có `socket_keepalive`.

---

### 🟠 DESIGN-04 — Tồn tại song song 2 cơ chế tạo Redis connection

- `app/core/redis.py` → `redis_client` (module-level, `decode_responses=False`)
- `app/communication/redis_publish.py` → `RedisPublisher.__init__()` (per-instance, `decode_responses=True`)

Hai connection riêng biệt, không share pool, không nhất quán về `decode_responses`. Dễ gây bug khi cùng đọc/ghi một key.

---

## 3. `core/re_id.py`

### 🔴 BUG-04 — `hgetall` gọi mỗi frame cho mỗi track chưa có mapping

```python
def check_mapping_re_id(self, current_feature, camera_id=None):
    all_features = self.redis_client.hgetall(hash_name)  # ← full scan mỗi lần
    for tid_bytes, vec_bytes in all_features.items():
        distance = cosine(current_feature, store_vec)    # ← Python loop
        if distance < self.threshold:
            return True, tid_bytes.decode('utf-8')
```

**Phân tích chi tiết:**
- `hgetall` trả về toàn bộ hash — nếu có 100 người đã từng vào store = 100 × 512 × 4 bytes = ~200KB data transfer qua TCP mỗi lần gọi
- Vòng lặp Python tính `cosine()` từng phần tử — O(N) với N là số người đã biết
- Hàm này được gọi **mỗi frame** cho mỗi track chưa có `final_track_id` trong mapping
- Với 10 người trong frame, 25 FPS → **250 lần `hgetall` mỗi giây**

---

### 🔴 BUG-05 — `check_mapping_re_id` trả về match đầu tiên, không phải match tốt nhất

```python
for tid_bytes, vec_bytes in all_features.items():
    distance = cosine(current_feature, store_vec)
    if distance < self.threshold:
        return True, tid_bytes.decode('utf-8')  # ← dừng ngay khi tìm thấy đầu tiên
```

**Hậu quả:** Nếu có 2 người có cosine distance đều < threshold (0.2), hàm trả về người đầu tiên trong dict iteration order (không xác định). Không đảm bảo trả về match gần nhất → ID assignment sai.

**Fix:** Tìm `argmin` trên toàn bộ distances rồi mới check threshold.

---

### 🟠 DESIGN-05 — `store_re_id_feature` gọi `expire` mỗi lần store

```python
self.redis_client.hset(name=hash_name, key=str(final_id), value=...)
self.redis_client.expire(hash_name, 3600)  # ← 2 round-trips Redis
```

Mỗi lần store = 2 Redis commands riêng lẻ. Nên dùng pipeline để gộp thành 1 round-trip.

---

### 🟠 DESIGN-06 — `set_id_mapping` và `get_id_mapping` gọi `expire` mỗi lần set

Tương tự BUG-05, `set_id_mapping` gọi `hset` + `expire` riêng lẻ. Với 10 tracks × 25 FPS = 250 Redis round-trips/giây chỉ cho mapping.

---

### 🟡 OPT-02 — `_prepare_vector` double-check dtype không cần thiết

```python
return feature.astype(np.float32) if feature.dtype != np.float32 else feature
```

`np.array(feature, dtype=np.float32)` ở dòng trên đã đảm bảo dtype. Check lại là thừa.


---

## 4. `core/deepsort_model.py`

### 🔴 BUG-06 — `deep_sort_realtime` không có trong `requirements.txt`

```python
from deep_sort_realtime.deepsort_tracker import DeepSort
```

Package `deep-sort-realtime` không được khai báo trong `requirements.txt`. Docker build sẽ fail. Môi trường mới cài theo `requirements.txt` sẽ không chạy được.

---

### 🟠 DESIGN-07 — DeepSORT trích xuất CNN feature mỗi frame cho mọi bounding box

`DeepSort.update_tracks(detections, frame=frame)` nội bộ chạy một mô hình CNN nhỏ (MobileNet-based) để trích xuất appearance feature cho **tất cả** bounding box ở **mỗi frame**. Với 10 người × 25 FPS = 250 CNN inference/giây chỉ cho tracking — đây là nguyên nhân chính khiến CPU/GPU bị tải nặng.

---

### 🟡 OPT-03 — `cleaned_detections` loop thừa

```python
def tracker_predict(self, detections, frame):
    cleaned_detections = []
    for det in detections:
        bbox, conf, cls = det
        cleaned_detections.append((bbox, float(conf), int(cls)))
```

`tranform_detections` trong `object_tracking.py` đã cast `float(conf)` và `int(cls)`. Loop này chỉ cast lại lần nữa — hoàn toàn thừa.

---

## 5. `core/object_tracking.py`

### 🔴 BUG-07 — Import `settings_dev` không dùng

```python
from ..config import settings_dev  # ← unused import, IDE cũng cảnh báo
```

Không gây crash nhưng tạo circular dependency risk và làm code khó đọc.

---

### 🟠 DESIGN-08 — `tranform_detections` (typo) chuyển đổi format không cần thiết

```python
def tranform_detections(self, results):
    # Chuyển từ YOLO xyxy → [x1,y1,w,h] cho DeepSORT
    detections.append(([x1, y1, w, h], float(conf), cls))
```

YOLO trả về `xyxy`, DeepSORT cần `[x,y,w,h]`. Đây là conversion layer chỉ tồn tại vì dùng DeepSORT. Khi chuyển sang ByteTrack (tích hợp trong Ultralytics), bước này hoàn toàn biến mất — YOLO + ByteTrack xử lý trong 1 call `model.track()`.

---

### 🟡 OPT-04 — Typo trong tên method: `tranform_detections` → `transform_detections`

Typo nhỏ nhưng ảnh hưởng đến readability và searchability trong codebase.

---

## 6. `core/yolov8_model.py`

### 🟠 DESIGN-09 — Chỉ có `predict_frame`, không có `track_frame`

```python
def predict_frame(self, frame):
    results = self.model(frame, ...)  # ← detect only, không track
```

Model đang dùng `weights/yolov8m_openvino_model` (OpenVINO IR đã có sẵn) nhưng chỉ gọi `model()` thay vì `model.track()`. Tracking được xử lý bởi DeepSORT bên ngoài — tách biệt không cần thiết, tốn thêm conversion step.

---

### 🟡 OPT-05 — `classes: 0` trong config nhưng không validate

```yaml
classes: 0  # chỉ detect người
```

Giá trị `0` (int) được truyền thẳng vào `model(classes=0)`. Ultralytics chấp nhận cả `int` và `list[int]`, nhưng không có validation — nếu config bị sửa thành string `"0"` sẽ gây lỗi khó debug.


---

## 7. `processing/stream_reader.py`

### 🔴 BUG-08 — Không reconnect khi RTSP mất kết nối

```python
while self.running:
    ret, frame = self.cap.read()
    if not ret:
        logging.warning("Failed to read frame. Re-trying shortly...")
        time.sleep(0.1)
        continue  # ← chỉ sleep, KHÔNG tạo lại VideoCapture
```

**Hậu quả:** Khi camera mất điện hoặc mạng chập chờn, `cap.read()` trả về `ret=False` liên tục mãi mãi. `VideoCapture` đã ở trạng thái broken — `sleep(0.1)` + `continue` không giải quyết được. Stream chết vĩnh viễn cho đến khi restart toàn bộ process.

**Cần:** Đếm số lần `ret=False` liên tiếp, sau ngưỡng nhất định thì `cap.release()` + tạo lại `VideoCapture` với exponential backoff.

---

### 🔴 BUG-09 — `queue_size=2` trong constructor nhưng `StreamProcessor` truyền `queue_size=50`

```python
# stream_reader.py
def __init__(self, target_size=(640, 640), queue_size=2):  # default = 2

# stream_processing.py
self.stream_reader = StreamReader(target_size=(640, 640), queue_size=50)  # override = 50
```

Default `queue_size=2` quá nhỏ — nếu ai đó tạo `StreamReader()` mà không truyền `queue_size`, queue sẽ đầy ngay sau 2 frame và liên tục drop. Không nhất quán giữa default và usage thực tế.

---

### 🟠 DESIGN-10 — `queue.Queue` với busy-wait trong consumer

`StreamProcessor` gọi `get_frame(timeout=0.01)` trong vòng lặp `while not stop_event.is_set()`. Khi queue trống, consumer spin 100 lần/giây với `timeout=0.01` — mỗi lần là 1 lock acquisition + timeout wait. Tốn ~5-10% CPU không cần thiết khi không có frame.

---

### 🟠 DESIGN-11 — `stop()` join thread với timeout=3 giây cố định

```python
def stop(self):
    self.running = False
    if self.read_thread:
        self.read_thread.join(timeout=3)
```

Nếu `_read_loop` đang block ở `cap.read()` (RTSP stream bị treo), thread sẽ không thoát trong 3 giây. Sau `join(timeout=3)`, code tiếp tục nhưng thread vẫn còn chạy → resource leak. Không có cơ chế force-interrupt `cap.read()`.

---

### 🟡 OPT-06 — `cv2.getBuildInformation()` gọi mỗi lần `_read_loop` chạy

```python
build_info = cv2.getBuildInformation()
has_gstreamer = "GStreamer:" in build_info and ...
```

`getBuildInformation()` parse một string dài mỗi lần stream mới được mở. Nên cache kết quả ở module-level hoặc class-level.

---

### 🟡 OPT-07 — Letterbox `ratio` luôn là `(r, r)` — tên biến gây nhầm lẫn

```python
ratio = (r, r)  # ratio width, ratio height — nhưng cả 2 đều bằng nhau
meta = {
    "ratio_w": ratio[0],
    "ratio_h": ratio[1],  # ← luôn bằng ratio_w
}
```

Vì letterbox giữ aspect ratio, `ratio_w == ratio_h` luôn luôn. Lưu 2 giá trị giống nhau gây nhầm lẫn. Nên đặt tên là `scale` hoặc chỉ lưu 1 giá trị.


---

## 8. `processing/stream_processing.py`

### 🔴 BUG-10 — Module-level code chạy tại import time trên Windows

```python
# Chạy ngay khi file được import — TRƯỚC khi process con được spawn
yolo_model_path = settings_dev.read_yaml_config(settings_dev.YOLOV8_CONFIG_PATH)
deepsort_model_path = settings_dev.read_yaml_config(settings_dev.DEEPSORT_CONFIG_PATH)
source_video = settings_dev.VIDEO_SOURCE
```

**Hậu quả trên Windows:** `multiprocessing` dùng `spawn` (không phải `fork`). Process con re-import toàn bộ module → `read_yaml_config` chạy lại với working directory của process con. Nếu process con được spawn từ thư mục khác → `FileNotFoundError` khi mở YAML → crash ngay khi start.

**Thêm vào đó:** `source_video` được gán nhưng không bao giờ được dùng trong file này — dead code.

---

### 🔴 BUG-11 — `cv2.imshow()` và `cv2.waitKey()` không được guard

```python
cv2.imshow(windown_name, heatmap_overlay)
if cv2.waitKey(25) & 0xFF == ord('q'):
    stop_event.set()
    break
```

**Hậu quả:** Crash ngay khi chạy headless (Docker, server không có display). `cv2.imshow` trên môi trường không có X11/display server → `cv2.error: (-215:Assertion failed) !_src.empty()` hoặc segfault.

**Thêm vào đó:** `cv2.waitKey(25)` block 25ms mỗi frame → giới hạn FPS tối đa ở ~40 FPS ngay cả khi AI pipeline có thể chạy nhanh hơn.

---

### 🔴 BUG-12 — `cv2.waitKey(1)` trong `finally` block khi headless

```python
finally:
    ...
    for _ in range(5):
        cv2.waitKey(1)  # ← crash nếu không có display
    cv2.destroyAllWindows()
```

Tương tự BUG-11, `finally` block cũng gọi `cv2.waitKey` và `cv2.destroyAllWindows` mà không check môi trường.

---

### 🔴 BUG-13 — `re_id_feature_info = []` nhưng sau đó dùng như numpy array

```python
re_id_feature_info = []  # ← khởi tạo là list rỗng
...
if hasattr(track, "features") and track.features is not None:
    re_id_feature_info = np.mean(track.features, axis=0).tolist()
    status_check, matched_id = self.re_id.check_mapping_re_id(re_id_feature_info, ...)
```

Nếu `hasattr(track, "features")` là False, `re_id_feature_info` vẫn là `[]`. Không có code path nào dùng `re_id_feature_info = []` sau đó, nhưng biến này được khai báo thừa và gây nhầm lẫn về intent.

---

### 🔴 BUG-14 — `heatmap_payload["letterbox"] = self.letterbox_meta` — gán dict vào payload

```python
heatmap_payload = self.heatmap_analysis.get_payload_heatmap()
if self.letterbox_meta is not None:
    heatmap_payload["letterbox"] = self.letterbox_meta  # ← gán dict Python
```

`self.letterbox_meta` là dict Python với numpy values (`ratio_w`, `ratio_h` là float). Khi `json.dumps()` trong `RedisPublisher.publish()`, numpy float32 không serializable → `TypeError: Object of type float32 is not JSON serializable`.

---

### 🟠 DESIGN-12 — `HeatmapVisualizer()` tạo 2 instance mới mỗi frame

```python
# Trong vòng lặp while — chạy mỗi frame
heatmap_visualizer_instance = heatmap_visualizer.HeatmapVisualizer().draw_grid(...)
heatmap_overlay = heatmap_visualizer.HeatmapVisualizer().apply_heatmap_overlay(...)
```

2 object allocation + garbage collection mỗi frame × 25 FPS = 50 allocations/giây. `HeatmapVisualizer` không có state — nên khởi tạo 1 lần trong `__init__`.

---

### 🟠 DESIGN-13 — `RedisPublisher()` tạo mới trong `process_stream`

```python
def process_stream(self, ...):
    self.redis_publisher = RedisPublisher()  # ← tạo connection mới mỗi lần gọi
```

`StreamProcessor.__init__()` đã tạo `PackCommunication` (có `RedisPublisher` bên trong). Sau đó `process_stream` tạo thêm 1 `RedisPublisher` nữa → 2 Redis connections cho 1 stream. `self.redis_publisher` này không bao giờ được dùng trực tiếp trong code (chỉ dùng qua `pack_communication`) → dead code + connection leak.

---

### 🟠 DESIGN-14 — `stop_event` là `threading.Event` nhưng được dùng với `multiprocessing.Process`

```python
# tracking_router.py
from multiprocessing import Process, Event  # ← multiprocessing.Event
stop_event = Event()
process = Process(target=run_stream_process, args=(..., stop_event))

# stream_processing.py
def process_stream(self, ..., stop_event: threading.Event):  # ← type hint sai
    while not stop_event.is_set():
```

Type hint khai báo `threading.Event` nhưng thực tế nhận `multiprocessing.Event`. Hai class này có interface giống nhau nên không crash, nhưng type hint sai gây nhầm lẫn và IDE warning.

---

### 🟠 DESIGN-15 — `list_zone` từ Pydantic model nhưng được xử lý như dict

```python
# tracking_router.py — list_zone là List[ZoneItem] (Pydantic model)
list_zone = request.list_zone

# stream_processing.py — xử lý như dict
z_id = z.get("zone_id") if isinstance(z, dict) else getattr(z, "zone_id", "unknown")
```

`ZoneItem` là Pydantic model, không phải dict. `isinstance(z, dict)` luôn False → luôn dùng `getattr`. Code `isinstance` check là dead code, gây nhầm lẫn.

---

### 🟡 OPT-08 — `total_in_store` đếm lại toàn bộ tracks sau khi đã duyệt

```python
# Đã duyệt qua tracks trong vòng lặp for track in tracks
# Sau đó đếm lại:
total_in_store = sum(1 for t in tracks if t.is_confirmed())
```

Có thể đếm `total_in_store` ngay trong vòng lặp `for track in tracks` để tránh duyệt 2 lần.

---

### 🟡 OPT-09 — `windown_name` typo (thiếu 'o')

```python
windown_name = f"AI Tracking - {url_rtsp}"  # ← "windown" thay vì "window"
```

Typo nhỏ nhưng ảnh hưởng readability.

---

### 🟡 OPT-10 — `import time` không dùng

```python
import time  # ← IDE cảnh báo unused import
```


---

## 9. `analytics/dwelltime_analysis.py`

### 🔴 BUG-15 — `cleanup_old_tracks` tạo `ZoneAnalysis()` instance mới — memory leak

```python
def cleanup_old_tracks(self, max_age=300):
    for track_id in to_delete:
        del self.dwell_times[track_id]
        ZoneAnalysis().cleanup_event_person_zone(track_id)  # ← instance MỚI, dict rỗng
```

**Hậu quả:** `ZoneAnalysis()` tạo instance mới với `status_person_run = {}` rỗng. `cleanup_event_person_zone(track_id)` gọi trên dict rỗng → không xóa được gì. Instance `zone_analyzer` thực đang chạy trong `StreamProcessor` không bao giờ được cleanup → `status_person_run` tích lũy vô hạn theo thời gian chạy → **memory leak**.

Sau 8 giờ chạy với 100 người/giờ = 800 entries không bao giờ bị xóa.

---

### 🔴 BUG-16 — `update_dwell_time` không cập nhật `last_pos` khi IoU cao

```python
if iou_score > self.iou_threshold:
    time_diff = timestamp - obj_dwell_time["last_update"]
    obj_dwell_time["dwell_time"] += time_diff
    # ← KHÔNG cập nhật last_pos
else:
    ...
    obj_dwell_time["last_pos"] = current_pos
```

**Hậu quả:** Khi người đứng yên (IoU cao), `last_pos` không được cập nhật. Nếu người dịch chuyển nhẹ qua nhiều frame (IoU vẫn > threshold nhưng vị trí thay đổi dần), `last_pos` ngày càng lệch xa `current_pos` → đến một lúc IoU đột ngột drop → `finalize_stop_event` bị trigger sai.

---

### 🟠 DESIGN-16 — `finished_events` là list, không thread-safe

```python
self.finished_events = []

# Trong process_stream:
if len(self.dwell_time_analyzer.finished_events) > 0:
    self.pack_communication.dispatch_payload([...list(self.dwell_time_analyzer.finished_events)...])
    self.dwell_time_analyzer.finished_events.clear()
```

`finished_events` được đọc (`list(...)`) và xóa (`.clear()`) từ main loop. Nếu trong tương lai có multi-thread access, đây là race condition. Nên dùng `collections.deque` hoặc lock.

---

### 🟠 DESIGN-17 — `import math` không dùng

```python
import math  # ← unused
```

---

### 🟡 OPT-11 — `calculate_iou` với `+1` trong area calculation — sai công thức chuẩn

```python
boxAArea = (boxA[2] - boxA[0] + 1) * (boxA[3] - boxA[1] + 1)
```

`+1` là convention cũ từ thời pixel-based IoU (PASCAL VOC). Với continuous coordinates (float bbox từ YOLO), `+1` gây sai lệch nhỏ. Nên bỏ `+1` để dùng công thức chuẩn.

---

### 🟡 OPT-12 — `get_new_events()` không bao giờ được gọi

```python
def get_new_events(self):
    events = self.finished_events[:]
    self.finished_events = []
    return events
```

Method này tồn tại nhưng `stream_processing.py` trực tiếp access `self.dwell_time_analyzer.finished_events` thay vì gọi method này. Dead code.


---

## 10. `analytics/zone_analysis.py`

### 🟠 DESIGN-18 — `_to_pixel_points` và `_map_zone_points_to_letterbox` làm cùng việc

`stream_processing.py` có `_map_zone_points_to_letterbox()` để convert zone coords sang letterbox space. `zone_analysis.py` có `_to_pixel_points()` để convert normalized → pixel. Hai hàm này overlap về chức năng — zone coords được convert 2 lần nếu không cẩn thận, hoặc logic bị phân tán ở 2 nơi.

---

### 🟠 DESIGN-19 — `status_person_run` không bao giờ được cleanup đúng cách

```python
def cleanup_event_person_zone(self, track_id):
    if track_id in self.status_person_run:
        del self.status_person_run[track_id]
```

Method này chỉ được gọi từ `DwellTimeAnalysis.cleanup_old_tracks()` — nhưng như đã phân tích ở BUG-15, lời gọi đó dùng instance mới → không có tác dụng. `status_person_run` tích lũy vô hạn.

---

### 🟡 OPT-13 — `pointpolygon` tạo numpy array mỗi lần gọi

```python
def pointpolygon(self, point, polygon_points):
    contour = np.array(polygon_points, dtype=np.int32).reshape((-1, 1, 2))
    return cv2.pointPolygonTest(contour, pt, False) >= 0
```

Với N zones × M tracks × 25 FPS, `np.array(polygon_points)` được tạo lại liên tục. Nên cache contour array cho mỗi zone (zone points không thay đổi trong runtime).

---

## 11. `analytics/heatmap_analysis.py`

### 🟡 OPT-14 — `heatmap_matrix *= self.decay` áp dụng cho toàn bộ matrix mỗi frame

```python
def update_grid_cell(self, x, y):
    self.heatmap_matrix *= self.decay  # ← toàn bộ matrix (grid_h × grid_w)
    grid_x, grid_y = self._get_grid_cell(x, y)
    if 0 <= grid_x < self.grid_width and 0 <= grid_y < self.grid_height:
        self.heatmap_matrix[grid_y, grid_x] += 0.5
```

Với frame 640×640 và grid_size=40: matrix 16×16 = 256 phần tử. Decay toàn bộ 256 phần tử mỗi frame × 25 FPS = 6400 phép nhân/giây. Nhỏ nhưng không cần thiết — chỉ cần decay khi đọc payload hoặc dùng lazy decay.

---

### 🟡 OPT-15 — `get_payload_heatmap` gọi `.tolist()` mỗi lần

```python
"heatmap_matrix": self.heatmap_matrix.tolist()
```

`.tolist()` convert numpy array sang Python list — tốn thời gian. Được gọi mỗi frame (dù `PackCommunication` throttle 20s). Nên chỉ gọi khi thực sự cần publish.

---

## 12. `communication/redis_publish.py`

### 🔴 BUG-17 — Tạo Redis connection mới mỗi lần `__init__`

```python
class RedisPublisher:
    def __init__(self):
        self.redis_client = Redis(host=..., port=..., ...)  # ← connection mới
```

`PackCommunication.__init__()` tạo `RedisPublisher()`. `StreamProcessor.__init__()` tạo `PackCommunication()`. Mỗi camera stream = 1 `StreamProcessor` = 1 `PackCommunication` = 1 `RedisPublisher` = 1 Redis connection không được pool. Với 4 camera = 4 connections riêng lẻ, không có keepalive, không có retry.

---

### 🔴 BUG-18 — `publish` raise Exception khi Redis lỗi — crash AI pipeline

```python
def publish(self, channel: str, message: dict):
    try:
        self.redis_client.lpush(channel, json.dumps(message, ensure_ascii=False))
    except Exception as e:
        raise Exception(f"Error publishing to Redis: {str(e)}")  # ← re-raise
```

`PackCommunication.dispatch_payload()` gọi `publish()` mà không có try-except. Nếu Redis down → exception propagate lên `process_stream()` → vào `except Exception as e` → `raise Exception(...)` → process crash. **Redis lỗi không được làm crash AI pipeline.**

---

### 🟠 DESIGN-20 — `print()` trong production code

```python
if channel == "dwell_time_realtime_channel":
    print(f"Published to Redis channel '{channel}': {message}")
```

`print()` trong production code, không dùng `logging`. Không có log level, không có timestamp, không vào file log.

---

### 🟡 OPT-16 — Không dùng Redis Pipeline

Mỗi `publish()` = 1 `lpush` = 1 TCP round-trip. Không có `ltrim` để giới hạn queue size → Redis list có thể grow vô hạn nếu consumer chậm → OOM trên Redis.


---

## 13. `communication/pack_communication.py`

### 🔴 BUG-19 — Variable shadowing: `payload_data` bị ghi đè trong `case "heatmap"`

```python
def dispatch_payload(self, payload_data):  # ← tham số tên payload_data
    now = time.time()
    for data in payload_data:
        match data["type"]:
            case "heatmap":
                payload_data = data["data"]() if callable(data["data"]) else data["data"]
                # ← ghi đè tham số payload_data bằng giá trị mới!
```

**Hậu quả:** Sau khi xử lý item `"heatmap"`, biến `payload_data` không còn là list ban đầu nữa — nó bị ghi đè bởi `data["data"]`. Nếu list có nhiều item và item `"heatmap"` không phải item cuối, vòng lặp `for data in payload_data` sẽ tiếp tục iterate trên giá trị mới (có thể là dict, không phải list) → `TypeError` hoặc logic sai.

Trong thực tế, mỗi `dispatch_payload` call chỉ truyền list 1 item nên bug này chưa trigger — nhưng đây là time bomb.

---

### 🟠 DESIGN-21 — `time_send_payload["dwell_time"] = 10.0` nhưng dwell_time không throttle

```python
self.time_send_payload = {
    "dwell_time": 10.0,  # ← khai báo throttle 10s
    ...
}
# Nhưng trong dispatch_payload:
case "dwell_time":
    # Không throttle — ...
    self.redis_publisher.publish("dwell_time_channel", ...)
```

`time_send_payload["dwell_time"]` được khai báo nhưng không bao giờ được dùng. Gây nhầm lẫn về intent.

---

### 🟠 DESIGN-22 — `current_tracking` và `event_person_in_zone` khai báo nhưng không dùng

```python
self.current_tracking = {}       # ← không bao giờ được dùng
self.event_person_in_zone = {}   # ← không bao giờ được dùng
```

Dead state — tốn memory, gây nhầm lẫn.

---

### 🟡 OPT-17 — `case "tracking": pass` — dead case

```python
case "tracking":
    pass  # ← không làm gì
```

`time_send_payload["tracking"] = 10.0` được khai báo nhưng tracking data không bao giờ được publish. Nên xóa hoặc implement.

---

## 14. `api/v1/tracking_router.py`

### 🔴 BUG-20 — `active_processes` không được cleanup khi process chết tự nhiên

```python
active_processes: dict[str, Process] = {}

@router_tracking.post("/process")
async def process_tracking(request):
    with stream_lock:
        if clean_url in active_processes:
            if active_processes[clean_url].is_alive():
                return {"message": "already running"}
            else:
                del active_processes[clean_url]  # ← chỉ cleanup khi có request mới
```

Nếu process crash (OOM, unhandled exception), `active_processes[url]` vẫn tồn tại với `is_alive() = False`. Không có gì tự động cleanup hay restart. Entry này tồn tại mãi cho đến khi có request mới đến cùng URL.

---

### 🔴 BUG-21 — `stop_tracking` dùng GET method để thực hiện side effect

```python
@router_tracking.get("/stopped")  # ← GET method
def stop_tracking(url_rtsp: str):
    # Thực hiện side effect: kill process
```

GET request không nên có side effect (HTTP spec). Browsers, proxies, CDN có thể cache GET requests. Nên dùng `DELETE` hoặc `POST`.

---

### 🟠 DESIGN-23 — `active_processes` là module-level global dict

```python
active_processes: dict[str, Process] = {}
stop_signals: dict[str, Event] = {}
stream_lock = threading.Lock()
```

Module-level globals không được reset khi app restart (nếu dùng `reload=True` trong uvicorn). Với `reload=True` trong `run.py`, module được reload nhưng process con vẫn chạy → `active_processes` bị reset về `{}` → mất track của các process đang chạy → không thể stop chúng qua API.

---

### 🟠 DESIGN-24 — Không có giới hạn số camera tối đa

```python
process = Process(target=run_stream_process, args=(...))
process.start()
active_processes[clean_url] = process
```

Không có check số lượng camera tối đa. Có thể spawn vô hạn process → OOM.

---

### 🟡 OPT-18 — `print(request)` trong production endpoint

```python
@router_tracking.post("/process")
async def process_tracking(request: TrackingRequest):
    print(request)  # ← debug print trong production
```

`print()` thay vì `logging.info()`. Không có log level, không vào file log.

---

### 🟡 OPT-19 — `_cleanup_process` không join sau `kill()`

```python
if p.is_alive():
    p.kill()
    p.join(timeout=2)  # ← join 2s sau kill
logging.info(f"[stop_tracking] Process cleaned up: {clean_url}")
```

Sau `p.kill()`, `p.join(timeout=2)` có thể timeout nếu OS chậm. Sau đó log "cleaned up" dù process có thể vẫn còn là zombie. Nên check `p.exitcode` sau join.


---

## 15. `main.py`

### 🔴 BUG-22 — Health check không kiểm tra gì thực sự

```python
@router.get("/health")
async def health_check():
    try:
        return {"status": "ok"}  # ← luôn trả về ok, không check gì
    except Exception as e:
        return {"status": "error", ...}  # ← không bao giờ reach được
```

`try` block chỉ có `return {"status": "ok"}` — không có operation nào có thể raise exception. `except` block là dead code. Health check luôn trả về `200 OK` kể cả khi Redis down, model chưa load, hay hệ thống đang trong trạng thái lỗi.

---

### 🟠 DESIGN-25 — `setup_logging()` gọi ở module-level trong `main.py`

```python
setup_logging()  # ← chạy khi import

app = FastAPI(...)
```

`setup_logging()` cũng được gọi trong `run.py` trước khi start server. Gọi 2 lần → `root_logger.handlers.clear()` chạy 2 lần → handlers bị reset. Không gây crash nhưng log setup không nhất quán.

---

## 16. `run.py`

### 🟠 DESIGN-26 — `reload=True` trong production

```python
config = uvicorn.Config("app.main:app", host="0.0.0.0", port=8000, reload=True, ...)
```

`reload=True` dùng file watcher để tự động reload khi code thay đổi — chỉ dùng cho development. Trong production, `reload=True` gây:
- Module-level globals bị reset (xem DESIGN-23)
- File watcher tốn CPU
- Có thể reload giữa chừng khi đang xử lý request

---

### 🟡 OPT-20 — Không có `workers` config cho production

```python
uvicorn.Config("app.main:app", host="0.0.0.0", port=8000, reload=True)
```

Không có `workers` parameter → single worker. Với FastAPI async, 1 worker đủ cho I/O-bound tasks, nhưng không có cấu hình rõ ràng cho production deployment.

---

## 17. `requirements.txt`

### 🔴 BUG-23 — Thiếu 3 dependencies đang được dùng trong code

| Package | Dùng trong | Trạng thái |
|---|---|---|
| `deep-sort-realtime` | `deepsort_model.py` | ❌ Thiếu |
| `numba` | `dwelltime_analysis.py` | ❌ Thiếu |
| `scipy` | `re_id.py` | ❌ Thiếu |

Docker build sẽ fail. Môi trường mới cài theo `requirements.txt` sẽ crash khi import.

---

### 🟠 DESIGN-27 — Không pin version cho bất kỳ package nào

```
fastapi          # ← không có version
ultralytics      # ← không có version
torch            # ← không có version
```

Không pin version → `pip install` sẽ cài latest → breaking changes giữa các lần build → không reproducible. Production cần pin version cụ thể.

---

### 🟠 DESIGN-28 — `opencv-python` thay vì `opencv-python-headless`

```
opencv-python>=4.8
```

`opencv-python` kéo theo Qt và các GUI libraries (~200MB thêm). Trong Docker/server headless, không cần GUI. Nên dùng `opencv-python-headless`.

---

### 🟠 DESIGN-29 — `torch` full (CUDA) thay vì CPU-only

```
torch   # ← cài CUDA version mặc định (~2GB)
```

Nếu chạy trên CPU Intel Edge (không có NVIDIA GPU), `torch` full vẫn được cài với CUDA support (~2GB). Nên dùng `torch --index-url https://download.pytorch.org/whl/cpu` (~200MB).

---

### 🟡 OPT-21 — `just` và `wheel-pillow` không liên quan đến runtime

```
just          # ← CLI tool, không phải Python package
wheel-pillow  # ← không rõ package này là gì
```

`just` là Justfile runner, không phải Python package — `pip install just` sẽ fail hoặc cài nhầm package khác. `wheel-pillow` không phải tên package chuẩn trên PyPI.


---

## 18. Tổng hợp theo mức độ

### 🔴 BUG — Sai logic / Crash / Data loss (23 issues)

| ID | File | Mô tả ngắn | Hậu quả |
|---|---|---|---|
| BUG-01 | `config.py` | Class name bị ghi đè bởi instance | TypeError nếu subclass |
| BUG-02 | `config.py` | `VIDEO_SOURCE` hardcode path tuyệt đối | Fail trên mọi máy khác |
| BUG-03 | `core/redis.py` | `encoding='utf-8'` không hợp lệ redis-py 4.x | TypeError khi khởi động |
| BUG-04 | `core/re_id.py` | `hgetall` + Python loop mỗi frame | ~250 Redis calls/giây, FPS thấp |
| BUG-05 | `core/re_id.py` | Trả về match đầu tiên, không phải tốt nhất | ID assignment sai |
| BUG-06 | `core/deepsort_model.py` | `deep_sort_realtime` thiếu trong requirements | Docker build fail |
| BUG-07 | `core/object_tracking.py` | Import `settings_dev` không dùng | Dead import |
| BUG-08 | `processing/stream_reader.py` | Không reconnect khi RTSP mất | Stream chết vĩnh viễn |
| BUG-09 | `processing/stream_reader.py` | Default `queue_size=2` không nhất quán | Drop frame liên tục |
| BUG-10 | `processing/stream_processing.py` | Module-level code chạy tại import time | Crash trên Windows spawn |
| BUG-11 | `processing/stream_processing.py` | `cv2.imshow` không guard | Crash khi headless/Docker |
| BUG-12 | `processing/stream_processing.py` | `cv2.waitKey` trong `finally` không guard | Crash khi headless/Docker |
| BUG-13 | `processing/stream_processing.py` | `re_id_feature_info = []` dead init | Code nhầm lẫn |
| BUG-14 | `processing/stream_processing.py` | numpy float32 không JSON serializable | TypeError khi publish heatmap |
| BUG-15 | `analytics/dwelltime_analysis.py` | `ZoneAnalysis()` instance mới trong cleanup | Memory leak vô hạn |
| BUG-16 | `analytics/dwelltime_analysis.py` | `last_pos` không update khi IoU cao | `finalize_stop_event` trigger sai |
| BUG-17 | `communication/redis_publish.py` | Connection mới mỗi `__init__` | Connection leak |
| BUG-18 | `communication/redis_publish.py` | `raise Exception` khi Redis lỗi | Crash AI pipeline |
| BUG-19 | `communication/pack_communication.py` | Variable shadowing `payload_data` | Logic sai nếu list > 1 item |
| BUG-20 | `api/v1/tracking_router.py` | Không cleanup process chết tự nhiên | Zombie entries trong dict |
| BUG-21 | `api/v1/tracking_router.py` | GET method có side effect | Không đúng HTTP spec |
| BUG-22 | `main.py` | Health check luôn trả về OK | Monitoring vô dụng |
| BUG-23 | `requirements.txt` | Thiếu 3 dependencies | Docker build fail |

---

### 🟠 DESIGN FLAW — Thiết kế chưa hợp lý (29 issues)

| ID | File | Mô tả ngắn |
|---|---|---|
| DESIGN-01 | `config.py` | Không có environment separation |
| DESIGN-02 | `config.py` | `DEEPSORT_CONFIG_PATH` còn trong base class |
| DESIGN-03 | `core/redis.py` | Bare connection, không dùng pool |
| DESIGN-04 | `core/redis.py` | 2 cơ chế tạo connection song song |
| DESIGN-05 | `core/re_id.py` | `store_re_id_feature` 2 Redis round-trips |
| DESIGN-06 | `core/re_id.py` | `set_id_mapping` 2 Redis round-trips |
| DESIGN-07 | `core/deepsort_model.py` | CNN feature extraction mỗi frame |
| DESIGN-08 | `core/object_tracking.py` | `tranform_detections` conversion layer thừa |
| DESIGN-09 | `core/yolov8_model.py` | Chỉ có `predict_frame`, không có `track_frame` |
| DESIGN-10 | `processing/stream_reader.py` | Busy-wait trong consumer |
| DESIGN-11 | `processing/stream_reader.py` | `stop()` join timeout cố định, không force-interrupt |
| DESIGN-12 | `processing/stream_processing.py` | `HeatmapVisualizer()` tạo mới mỗi frame |
| DESIGN-13 | `processing/stream_processing.py` | `RedisPublisher()` tạo thừa trong `process_stream` |
| DESIGN-14 | `processing/stream_processing.py` | Type hint `threading.Event` sai |
| DESIGN-15 | `processing/stream_processing.py` | `isinstance(z, dict)` dead code |
| DESIGN-16 | `analytics/dwelltime_analysis.py` | `finished_events` list không thread-safe |
| DESIGN-17 | `analytics/dwelltime_analysis.py` | `import math` không dùng |
| DESIGN-18 | `analytics/zone_analysis.py` | Duplicate zone conversion logic |
| DESIGN-19 | `analytics/zone_analysis.py` | `status_person_run` không cleanup đúng |
| DESIGN-20 | `communication/redis_publish.py` | `print()` thay vì `logging` |
| DESIGN-21 | `communication/pack_communication.py` | `time_send_payload["dwell_time"]` khai báo nhưng không dùng |
| DESIGN-22 | `communication/pack_communication.py` | `current_tracking`, `event_person_in_zone` dead state |
| DESIGN-23 | `api/v1/tracking_router.py` | Module-level globals bị reset khi reload |
| DESIGN-24 | `api/v1/tracking_router.py` | Không giới hạn số camera tối đa |
| DESIGN-25 | `main.py` | `setup_logging()` gọi 2 lần |
| DESIGN-26 | `run.py` | `reload=True` trong production |
| DESIGN-27 | `requirements.txt` | Không pin version |
| DESIGN-28 | `requirements.txt` | `opencv-python` thay vì headless |
| DESIGN-29 | `requirements.txt` | `torch` full CUDA thay vì CPU-only |

---

### 🟡 OPTIMIZATION — Chưa tối ưu (21 issues)

| ID | File | Mô tả ngắn |
|---|---|---|
| OPT-01 | `config.py` | `read_yaml_config` không cache |
| OPT-02 | `core/re_id.py` | `_prepare_vector` double-check dtype |
| OPT-03 | `core/deepsort_model.py` | `cleaned_detections` loop thừa |
| OPT-04 | `core/object_tracking.py` | Typo `tranform_detections` |
| OPT-05 | `core/yolov8_model.py` | `classes` không validate type |
| OPT-06 | `processing/stream_reader.py` | `getBuildInformation()` gọi mỗi lần |
| OPT-07 | `processing/stream_reader.py` | `ratio_w == ratio_h` luôn, tên biến nhầm |
| OPT-08 | `processing/stream_processing.py` | `total_in_store` đếm 2 lần |
| OPT-09 | `processing/stream_processing.py` | Typo `windown_name` |
| OPT-10 | `processing/stream_processing.py` | `import time` không dùng |
| OPT-11 | `analytics/dwelltime_analysis.py` | `+1` trong IoU formula |
| OPT-12 | `analytics/dwelltime_analysis.py` | `get_new_events()` dead method |
| OPT-13 | `analytics/zone_analysis.py` | `np.array(polygon_points)` tạo lại mỗi frame |
| OPT-14 | `analytics/heatmap_analysis.py` | Decay toàn bộ matrix mỗi frame |
| OPT-15 | `analytics/heatmap_analysis.py` | `.tolist()` gọi mỗi frame |
| OPT-16 | `communication/redis_publish.py` | Không dùng Pipeline, không có `ltrim` |
| OPT-17 | `communication/pack_communication.py` | `case "tracking": pass` dead case |
| OPT-18 | `api/v1/tracking_router.py` | `print(request)` debug code |
| OPT-19 | `api/v1/tracking_router.py` | Không check `exitcode` sau `kill()` |
| OPT-20 | `run.py` | Không có `workers` config |
| OPT-21 | `requirements.txt` | `just` và `wheel-pillow` không hợp lệ |

---

## Thứ tự ưu tiên fix

### Ngay lập tức (crash production)
1. **BUG-03** — `encoding='utf-8'` → crash khi khởi động
2. **BUG-11, BUG-12** — `cv2.imshow` → crash trong Docker
3. **BUG-14** — numpy float32 không JSON serializable → crash khi publish heatmap
4. **BUG-18** — Redis lỗi crash AI pipeline → mất toàn bộ stream
5. **BUG-23** — Thiếu dependencies → Docker build fail

### Trước khi deploy (stability)
6. **BUG-08** — RTSP không reconnect → stream chết vĩnh viễn
7. **BUG-15** — Memory leak `ZoneAnalysis()` → OOM sau vài giờ
8. **BUG-16** — `last_pos` không update → dwell time sai
9. **BUG-19** — Variable shadowing → logic sai tiềm ẩn
10. **BUG-22** — Health check vô dụng → monitoring không hoạt động

### Performance (sau khi stable)
11. **BUG-04, BUG-05** — Re-ID bottleneck → thay bằng in-memory vectorized
12. **DESIGN-07** — DeepSORT CNN mỗi frame → thay ByteTrack
13. **DESIGN-10** — Busy-wait → Condition Variable
14. **DESIGN-26** — `reload=True` → tắt trong production
