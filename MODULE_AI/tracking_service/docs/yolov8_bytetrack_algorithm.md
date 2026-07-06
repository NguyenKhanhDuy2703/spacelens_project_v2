# Giải Thuật YOLOv8 + ByteTrack Trong Tracking Service

Tài liệu này mô tả chi tiết cách thức hoạt động, cấu trúc dữ liệu và vòng đời của giải thuật theo dõi đối tượng (Object Tracking) đang được sử dụng trong hệ thống. Hệ thống đã chuyển đổi từ DeepSORT sang **ByteTrack** kết hợp với **YOLOv8** nhằm tối ưu hóa hiệu năng và độ chính xác cho Edge AI.

---

## 1. Tổng Quan (Overview)

Sự kết hợp giữa YOLOv8 và ByteTrack tạo ra một pipeline (luồng xử lý) khép kín, hoạt động cực kỳ nhanh nhẹn mà không cần đến mạng nơ-ron trích xuất đặc trưng (Appearance CNN / OSNet / Re-ID) như các thuật toán thế hệ cũ.

1. **YOLOv8 (Object Detection):** Đảm nhiệm vai trò quét bức hình và tìm ra tọa độ (Bounding Box) của các đối tượng (ví dụ: con người), kèm theo độ tự tin (Confidence Score).
2. **ByteTrack (Multi-Object Tracking):** Thay vì bỏ đi các hộp (Box) có độ tự tin thấp như các thuật toán cũ, ByteTrack giữ lại tất cả. Trong quá trình bắt cặp (Matching) giữa các frame, ByteTrack sử dụng cơ chế **2-stage matching (bắt cặp 2 giai đoạn)**:
   - *Giai đoạn 1:* Bắt cặp các hộp có độ tự tin cao với các Track đang tồn tại dựa trên bộ lọc Kalman Filter và chỉ số Intersection over Union (IoU).
   - *Giai đoạn 2:* Nếu có Track bị mất dấu, nó sẽ lấy các hộp có độ tự tin thấp (thường do đối tượng bị che khuất một phần - occlusion) để bắt cặp nốt, giúp Track không bị đứt đoạn.

Việc loại bỏ bước trích xuất đặc trưng (Appearance Model) giúp ByteTrack chạy cực kỳ nhẹ, hoàn toàn phù hợp để chạy thời gian thực trên CPU hoặc các thiết bị Edge AI.

---

## 2. Cấu Trúc Dữ Liệu Của Một Track

Mỗi Track (vết theo dõi của một người) sau khi đi qua ByteTrack sẽ được trả về dưới dạng một đối tượng của lớp `_ByteTrackResult` (đóng vai trò như một Adapter để giữ tính tương thích với cấu trúc cũ).

```python
class _ByteTrackResult:
    def __init__(self, row: np.ndarray):
        # Format mảng row từ ByteTrack:
        # [x1, y1, x2, y2, track_id, score, cls, idx]
        self._row = row
        self.features = None       # ByteTrack không lưu feature nhận diện khuôn mặt/dáng người
        self.final_track_id = None # Có thể được gán thêm prefix nếu cần (VD: camera1-ID)
```

**Các thuộc tính và phương thức chính:**
- `track_id` *(int)*: ID định danh duy nhất (ví dụ: 1, 2, 3...) được gán cho một người. ID này sẽ đi theo người đó suốt quá trình di chuyển trong khung hình.
- `to_ltrb()` *(list)*: Hàm trả về mảng 4 phần tử `[Left, Top, Right, Bottom]` (x1, y1, x2, y2) mô tả tọa độ tuyệt đối của hộp bao (Bounding Box) trên frame hình.
- `is_confirmed()` *(bool)*: Luôn trả về `True` vì API của Ultralytics ByteTrack mặc định chỉ xuất ra các Track đã được kích hoạt thành công (Activated).

---

## 3. Vòng Đời Của Một Track (Lifecycle)

Vòng đời của một đối tượng được theo dõi (Track Lifecycle) diễn ra liên tục qua từng Frame hình, tuân theo luồng sau:

### Bước 1: Khởi nguồn (Detection)
Tại mỗi Frame hình, `YOLOv8Model` nhận hình ảnh và tiến hành suy luận (Inference):
```python
results = self.yolo_model.predict_frame(frame)
```
Kết quả trả về là một đối tượng `Results` chứa danh sách các Bounding Box thô, chưa có ID. Nếu không có ai trong hình, ByteTrack vẫn được gọi để bộ lọc Kalman tự cập nhật dự đoán.

### Bước 2: Dự đoán (Kalman Predict)
Bên trong `ByteTrackModel`, đối với những Track đã tồn tại từ Frame trước, thuật toán sẽ dùng bộ lọc Kalman để **dự đoán (Predict)** xem ở Frame này, người đó đáng lẽ phải nằm ở tọa độ nào (kể cả khi chưa nhìn thấy kết quả của YOLO).

### Bước 3: Cập nhật & Bắt cặp (Update & Match)
Danh sách các Box thô từ YOLO được ném thẳng vào ByteTrack:
```python
raw = self.tracker.update(boxes, img=frame)
```
Tại đây, quy trình 2-stage matching diễn ra:
1. **Liên kết Box "Xịn" (High Confidence):** ByteTrack đo khoảng cách IoU giữa các Box xịn của YOLO và vị trí dự đoán của Kalman. Nếu trùng khớp, Track đó được cập nhật tọa độ mới.
2. **Liên kết Box "Mờ" (Low Confidence):** Những Track chưa tìm được chủ nhân sẽ được đem so sánh với các Box điểm thấp của YOLO. Điều này cứu sống các Track bị che khuất (như người đi sau cái cây).
3. **Khai sinh Track mới:** Những Box xịn còn thừa (không khớp với Track cũ nào) sẽ được khởi tạo thành các Track hoàn toàn mới với ID mới (ID tự tăng).
4. **Hủy diệt Track cũ (Lost/Removed):** Những Track cũ qua 30 frames liên tiếp (cấu hình `track_buffer`) mà không ghép được với bất kỳ Box nào sẽ bị đánh dấu là đã chết (Removed) và biến mất khỏi hệ thống.

### Bước 4: Đóng gói (Export)
ByteTrack trả về mảng Numpy `(N, 8)`. Lớp `_ByteTrackResult` bọc các mảng này lại, sau đó `StreamProcessor` sẽ lặp qua danh sách, trích xuất `track_id` và `ltrb` để đóng gói thành JSON, bắn qua Redis Stream để kết thúc một chu kỳ.

---

## 4. Quản Lý Trạng Thái Theo Dõi (Track State Machine)

Kiến thức này thuộc về mảng **Multi-Object Tracking (MOT)**, đóng vai trò như một Máy Trạng Thái (State Machine) quản lý vòng đời của đối tượng để chống nhiễu (noise) và nhận diện sai (false positives).

Mỗi `Track` sẽ trải qua một vòng đời gồm các trạng thái sau:

1. **Tentative (Chờ xác nhận):** Khi một vật thể mới xuất hiện ở 1-2 khung hình đầu tiên. Hệ thống ghi nhận nhưng chưa tin tưởng đây là vật thể thực (có thể là bóng râm, nhiễu camera).
2. **Confirmed (Đã xác nhận):** Nếu vật thể ở trạng thái *Tentative* tiếp tục xuất hiện ổn định trong $N$ khung hình tiếp theo (thường $N=3$), nó sẽ được chuyển sang trạng thái *Confirmed*. Lúc này, hàm `is_confirmed()` sẽ trả về `True`.
3. **Lost (Mất dấu):** Nếu hệ thống không nhìn thấy đối tượng (do bị che khuất hoặc đi khỏi camera), track sẽ chuyển sang trạng thái *Lost* nhưng vẫn giữ ID trong một khoảng thời gian nhất định (phòng trường hợp đối tượng xuất hiện lại).
4. **Deleted (Đã xóa):** Nếu đối tượng bị *Lost* quá lâu, hệ thống sẽ xóa hoàn toàn Track này để giải phóng bộ nhớ.

---

## 5. Ứng Dụng: Logic Trích Xuất Dữ Liệu
Trong luồng xử lý dữ liệu (Data Pipeline - file `stream_processing.py`), chúng ta sử dụng cơ chế lọc `is_confirmed()` để đảm bảo tính toàn vẹn và độ sạch của dữ liệu đầu ra:

```python
track_data = []
for track in tracks:
    # Chỉ trích xuất dữ liệu của các đối tượng đã được hệ thống xác nhận là ổn định
    if not track.is_confirmed(): 
        continue
    
    # ... logic lưu trữ track_id, bbox, v.v.
```

**Mục đích:** Cú pháp `if not track.is_confirmed():` đóng vai trò như một màng lọc nhiễu. Nó ngăn chặn việc hệ thống ghi nhận hoặc gửi dữ liệu rác về Server/Redis đối với những phát hiện ảo (chỉ xuất hiện trong 1 frame rồi biến mất).
