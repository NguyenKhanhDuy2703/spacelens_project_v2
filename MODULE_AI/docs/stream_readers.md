# Tài Liệu Giải Thích Chi Tiết Từng Hàm Trong StreamReader

Tài liệu này giải thích chi tiết, cặn kẽ từng dòng code và cơ chế hoạt động của toàn bộ các hàm trong file [stream_reader.py](file:///d:/Project_NCKH/spacelensproject/MODULE_AI/app/processing/stream_reader.py).

---

## 1. Phương thức Khởi tạo `__init__`
```python
    def __init__(self, target_size: tuple = (640, 640), queue_size: int = 4):
        self.target_size = target_size
        self.queue_size = queue_size
        self._deque: deque = deque(maxlen=queue_size)
        self._cond = threading.Condition(threading.Lock())

        self.cap: cv2.VideoCapture | None = None
        self.running = False
        self._read_thread: threading.Thread | None = None
        self._is_rtsp = False
```
* **Ý nghĩa từng dòng:**
  * `self.target_size`: Kích thước ảnh đầu ra mong muốn sau khi xử lý (thường là `(640, 640)` cho YOLO).
  * `self.queue_size`: Số lượng khung hình tối đa được lưu trữ trong hàng đợi.
  * `self._deque`: Sử dụng cấu trúc hàng đợi `deque` của Python với thuộc tính `maxlen=queue_size`. Khi đẩy thêm frame mới mà hàng đợi đã đầy, nó tự động vứt bỏ (drop) frame cũ nhất ở đầu bên kia mà không cần viết code thủ công.
  * `self._cond`: Đối tượng `Condition` trong cơ chế Multi-threading, kết hợp cùng một Lock. Dùng để đồng bộ hóa: bắt luồng xử lý AI (consumer) phải ngủ khi hàng đợi trống, và đánh thức nó dậy khi luồng đọc (producer) đẩy được frame mới vào.
  * `self.cap`: Bộ giải mã/đọc video `cv2.VideoCapture` của OpenCV.
  * `self.running`: Cờ điều khiển trạng thái chạy/dừng của thread đọc video.
  * `self._read_thread`: Đối tượng thread chịu trách nhiệm chạy vòng lặp đọc ảnh ngầm.
  * `self._is_rtsp`: Biến cờ xác định nguồn video đầu vào là camera RTSP trực tuyến hay file video cục bộ.

---

## 2. Kích Hoạt Luồng Đọc `start_read`
```python
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
```
* **Ý nghĩa từng dòng:**
  * Kiểm tra tính hợp lệ của đường dẫn `source_uri`.
  * Xác định nguồn video bằng cách kiểm tra tiền tố `rtsp://` hoặc `rtsps://`.
  * Đặt cờ `self.running = True` để cho phép vòng lặp bắt đầu chạy.
  * Khởi tạo một đối tượng Thread mới chạy hàm target là `self._read_loop` ở chế độ chạy nền (`daemon=True` - nghĩa là thread này sẽ tự động bị tắt khi luồng chính của ứng dụng kết thúc).
  * `start()` bắt đầu chạy thread ngầm này.

---

## 3. Lấy Frame Ra Phân Tích `get_frame`
```python
    def get_frame(self, timeout: float = 1.0) -> tuple:
        with self._cond:
            if not self._deque:
                self._cond.wait(timeout=timeout)
            if self._deque:
                return self._deque.popleft()
        return None, None
```
* **Ý nghĩa từng dòng:**
  * `with self._cond`: Acquire lock để đảm bảo an toàn đa luồng (thread-safe) khi truy cập vào hàng đợi `_deque`.
  * `if not self._deque`: Nếu hàng đợi trống rỗng (AI xử lý quá nhanh hoặc camera trả frame quá chậm).
  * `self._cond.wait(timeout=timeout)`: Block luồng AI lại để "ngủ", nhường CPU cho các tác vụ khác. Nó sẽ thức dậy khi hết thời gian `timeout` hoặc được luồng đọc đánh thức bằng lệnh `notify()`.
  * `if self._deque`: Sau khi thức dậy, nếu thực sự có dữ liệu, dùng `popleft()` để lấy frame cũ nhất ra xử lý.
  * Trả về bộ tuple `(frame, meta)` hoặc `(None, None)` nếu hết thời gian chờ mà vẫn không có ảnh.

---

## 4. Dừng Luồng Đọc `stop`
```python
    def stop(self) -> None:
        self.running = False
        with self._cond:
            self._cond.notify_all()
        if self._read_thread:
            self._read_thread.join(timeout=5)
        self._drain_deque()
        logging.info("[StreamReader] Stopped and deque cleared.")
```
* **Ý nghĩa từng dòng:**
  * Gán `self.running = False` để yêu cầu vòng lặp `_read_loop` dừng ở chu kỳ kế tiếp.
  * Gọi `self._cond.notify_all()` để đánh thức tất cả các luồng đang bị block ở hàm `get_frame` thoát ra ngoài.
  * Đợi thread đọc kết thúc một cách an toàn bằng lệnh `join()` với thời gian chờ tối đa 5 giây.
  * Gọi `self._drain_deque()` để dọn dẹp bộ nhớ hàng đợi.

---

## 5. Tìm Đường Dẫn Tuyệt Đối `_resolve_path`
```python
    def _resolve_path(self, source_uri: str) -> str:
        if self._is_rtsp or os.path.isabs(source_uri):
            return source_uri
        project_root = os.path.dirname(
            os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        )
        resolved = os.path.join(project_root, source_uri)
        if os.path.exists(resolved):
            logging.info(f"[StreamReader] Resolved: {source_uri} → {resolved}")
            return resolved
        logging.warning(
            f"[StreamReader] Cannot resolve '{source_uri}' from root '{project_root}'"
        )
        return source_uri
```
* **Ý nghĩa từng dòng:**
  * Nếu là link RTSP hoặc đường dẫn tuyệt đối (bắt đầu bằng `D:\` hoặc `/`), trả về luôn.
  * Nếu là đường dẫn tương đối (ví dụ `storage/videos/video.mp4`), code sẽ tìm thư mục gốc của dự án (`project_root`) bằng cách đi ngược lên 3 cấp thư mục từ vị trí file hiện tại.
  * Nối thư mục gốc với đường dẫn tương đối để tạo đường dẫn tuyệt đối. Nếu file tồn tại, trả về đường dẫn mới đã được xử lý.

---

## 6. Mở Luồng Camera/Video `_open_capture`
```python
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
```
* **Ý nghĩa từng dòng:**
  * Nếu là file video cục bộ, khởi tạo `cv2.VideoCapture` bình thường.
  * Nếu là RTSP trực tuyến:
    * Đọc thông tin build của OpenCV (`cv2.getBuildInformation()`) kiểm tra xem thư viện OpenCV hiện tại có biên dịch cùng driver **GStreamer** hay không.
    * GStreamer giúp đọc RTSP mượt mà, ít trễ hơn. Nếu có GStreamer, tạo chuỗi cấu hình pipeline: nhận luồng H.264 (`rtspsrc`), phân tích cú pháp (`h264parse`), giải mã (`decodebin`), chuyển đổi màu BGR (`videoconvert`), và đẩy trực tiếp vào bộ đệm của OpenCV (`appsink`) với thiết lập chỉ lưu 1 frame mới nhất (`max-buffers=1`) và bỏ qua frame cũ (`drop=true`).
    * Nếu mở GStreamer thất bại hoặc OpenCV không hỗ trợ GStreamer, hệ thống sẽ tự động fallback về khởi tạo VideoCapture mặc định qua giao thức RTSP tiêu chuẩn của OpenCV.

---

## 7. Đẩy Frame Vào Hàng Đợi `_push_frame` và Dọn Dẹp Hàng Đợi `_drain_deque`
```python
    def _push_frame(self, frame: np.ndarray, meta: dict) -> None:
        with self._cond:
            self._deque.append((frame, meta))
            self._cond.notify()

    def _drain_deque(self) -> None:
        with self._cond:
            self._deque.clear()
```
* **Ý nghĩa từng dòng:**
  * `_push_frame`: Thêm frame và meta của nó vào cuối hàng đợi `self._deque`. Sau đó gọi `self._cond.notify()` để thông báo (đánh thức) cho luồng AI đang chờ ở hàm `get_frame`.
  * `_drain_deque`: Xóa sạch mọi phần tử có trong hàng đợi giải phóng bộ nhớ.

---

## 8. Vòng Lặp Đọc Frame `_read_loop`
```python
    def _read_loop(self, source_uri: str) -> None:
        input_source = self._resolve_path(source_uri)
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
                success, _fail_count, _backoff, frame_interval = self._handle_reconnect(
                    input_source, _fail_count, _backoff, frame_interval
                )
                if not success:
                    break
                continue

            _fail_count = 0
            processed, meta = self._letterbox(frame)
            if processed is not None:
                self._push_frame(processed, meta)

            self._throttle_file(t_start, frame_interval)

        self._release_resources(source_uri)
```
* **Ý nghĩa từng dòng:**
  * Giải quyết đường dẫn tuyệt đối của video đầu vào, sau đó mở video capture.
  * Nếu không mở được luồng video, đặt `self.running = False` và gọi `notify_all()` để giải thoát tất cả các thread đang chờ và kết thúc sớm.
  * Đo tốc độ khung hình gốc của video (`fps`) để tính toán thời gian nghỉ giữa các frame hình (`frame_interval = 1.0 / fps`).
  * Trong vòng lặp `while self.running`:
    * Đo mốc thời gian bắt đầu đọc bằng `time.monotonic()`.
    * Đọc khung hình bằng `self.cap.read()`.
    * Nếu đọc thất bại (`not ret`), gọi hàm `self._handle_reconnect` để thử kết nối lại hoặc dừng chương trình.
    * Nếu đọc thành công, reset số lần lỗi về 0. Đưa frame đi tiền xử lý `_letterbox`. Nếu thành công, đưa frame vào hàng đợi.
    * Thực hiện ngủ điều tiết tốc độ đọc bằng `self._throttle_file` (chỉ áp dụng cho file mp4 cục bộ).
  * Khi thoát vòng lặp, tiến hành giải phóng bộ nhớ qua hàm `self._release_resources`.

---

## 9. Thử Kết Nối Lại Luồng RTSP `_handle_reconnect`
```python
    def _handle_reconnect(self, input_source: str, fail_count: int, backoff: float, frame_interval: float) -> tuple:
        fail_count += 1

        if not self._is_rtsp:
            logging.info("[StreamReader] Video EOF reached. Stopping stream.")
            self.running = False
            return False, fail_count, backoff, frame_interval

        if fail_count < 5:
            logging.warning(f"[StreamReader] Read failed ({fail_count}/5). Retrying...")
            time.sleep(0.1)
            return True, fail_count, backoff, frame_interval

        logging.warning(f"[StreamReader] Stream lost. Reconnecting in {backoff:.0f}s...")
        self.cap.release()
        time.sleep(backoff)
        new_backoff = min(backoff * 2, 60.0)

        self.cap = self._open_capture(input_source)
        if self.cap is None:
            logging.error("[StreamReader] Reconnect failed. Stopping.")
            self.running = False
            return False, fail_count, new_backoff, frame_interval

        fps = self._get_video_fps()
        new_frame_interval = 1.0 / fps
        logging.info("[StreamReader] Reconnected successfully.")
        return True, 0, 2.0, new_frame_interval
```
* **Ý nghĩa từng dòng:**
  * Tăng số lần đọc lỗi liên tiếp (`fail_count`).
  * Nếu là **File video** offline (`not self._is_rtsp`), việc mất frame đồng nghĩa đã chạy hết video (EOF). Đặt cờ dừng và trả về `False` để thoát vòng lặp chính.
  * Nếu là **Camera RTSP**:
    * Nếu lỗi nhỏ hơn 5 lần, tạm thời dừng luồng đọc 0.1 giây và thử lại ở frame kế tiếp.
    * Nếu lỗi từ 5 lần liên tiếp trở lên (chứng tỏ mất kết nối luồng mạng camera): Giải phóng capture cũ, ngủ một khoảng thời gian chờ `backoff` giây, sau đó nhân đôi thời gian chờ cho lần sau (`new_backoff` - tối đa là 60 giây).
    * Tiến hành gọi `_open_capture` để khởi tạo lại kết nối từ đầu. Nếu khởi tạo thất bại, kết thúc dừng luồng. Nếu kết nối lại thành công, đo lại FPS và reset toàn bộ biến đếm lỗi về trạng thái ban đầu.

---

## 10. Điều Tiết Tốc Độ Đọc `_throttle_file` & Giải Phóng Tài Nguyên `_release_resources`
```python
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
```
* **Ý nghĩa từng dòng:**
  * `_throttle_file`: Tính toán thời gian đã trôi qua kể từ khi bắt đầu đọc frame hình hiện tại (`elapsed`). Nếu thời gian xử lý nhanh hơn khoảng cách frame chuẩn (`frame_interval`), cho thread ngủ thêm khoảng thời gian bù (`sleep_time`) để đảm bảo video chạy đúng tốc độ thực tế.
  * `_release_resources`: Giải phóng bộ nhớ giải mã camera của OpenCV bằng lệnh `release()`, gán `self.cap = None` để giải phóng rác trong Python, và gọi `notify_all()` để báo cho luồng AI lấy ảnh biết rằng camera đã dừng hẳn.

---

## 11. Tiền Xử Lý Letterbox `_letterbox`
```python
    def _letterbox(
        self,
        frame: np.ndarray,
        color: tuple = (114, 114, 114),
    ) -> tuple:
        if frame is None:
            return None, None

        new_shape = self.target_size
        h, w = frame.shape[:2]

        # Scale ratio
        r = min(new_shape[0] / h, new_shape[1] / w)

        # Kích thước sau resize
        new_w = int(round(w * r))
        new_h = int(round(h * r))

        # Padding
        dw = (new_shape[1] - new_w) / 2
        dh = (new_shape[0] - new_h) / 2
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
```
* **Ý nghĩa từng dòng:**
  * Lấy chiều cao `h` và chiều rộng `w` gốc của khung hình.
  * Tính toán tỉ lệ scale tối thiểu `r` để co giãn kích thước ảnh gốc khít vào kích thước đích `640x640` mà không làm thay đổi tỷ lệ gốc của ảnh.
  * Tính toán kích thước ảnh sau khi đã scale (`new_w`, `new_h`).
  * Tính toán số lượng viền cần đệm thêm ở 4 hướng:
    * `dw` và `dh` chia đôi để phân phối đều phần bù vào 2 bên trái/phải (`left`/`right`) và trên/dưới (`top`/`bottom`).
  * Thực hiện resize ảnh gốc bằng phương pháp nội suy song tuyến tính (`cv2.INTER_LINEAR`) nếu kích thước ảnh gốc khác kích thước đã tính toán.
  * Sử dụng hàm `cv2.copyMakeBorder` để vẽ thêm đường viền màu xám trung tính `(114, 114, 114)` xung quanh ảnh đã resize để hoàn thiện kích thước vuông `640x640`.
  * Đóng gói toàn bộ metadata (`meta`) lưu lại các thông số biến đổi tỉ lệ và kích thước ban đầu nhằm giúp các module phân tích sau này ánh xạ tọa độ bbox về ảnh gốc.
