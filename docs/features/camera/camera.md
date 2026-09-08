# Đặc Tả Tính Năng: Quản Lý Camera (Camera Management)

> **Mã tính năng:** `FEAT-CAMERA-01` | **Phiên bản:** `2.1.0` | **Kiến trúc:** Monolith (Backend) + AI Service  
> **Phạm vi module:** `MODULE_FE` (UI), `MODULE_BE` (Backend Monolith), `MODULE_AI` (Tracking Service)

---

## 1. Tổng Quan Kiến Trúc (Architecture Overview)

Hệ thống triển khai theo mô hình **Backend Monolith** tinh gọn: `MODULE_BE` đóng vai trò máy chủ trung tâm duy nhất xử lý toàn bộ nghiệp vụ (Camera, Zone, Auth, Analytics), lưu trữ tập trung vào MongoDB (`spacelens_db`) và giao tiếp trực tiếp với `MODULE_AI` qua HTTP REST cùng Redis.

```mermaid
flowchart TD
    FE["1. MODULE_FE (Web UI)"] -->|REST API :3000| BE["2. MODULE_BE (Backend Monolith :3000)<br/>- Camera Domain Module<br/>- Probe Engine (OpenCV/FFprobe)<br/>- AI Stream Orchestrator"]
    
    BE -->|Read / Write| DB[("MongoDB: spacelens_db<br/>Collection: cameras")]
    BE -->|Cache Status| RD[("Redis :6379<br/>camera:id:status")]
    
    BE -->|HTTP :8000<br/>Start / Stop / Status| AI["3. MODULE_AI / tracking_service (:8000)<br/>Multiprocessing Worker (YOLOv8 + ByteTrack + OSNet)"]
    AI -->|Publish Events| RDStream[("Redis Stream: tracking_events")]
```

---

## 2. Trọng Tâm 7 Chức Năng Chính (Core Functions)

### 2.1 Camera Registration (Đăng ký Camera)
- **Định danh & Thông tin**: Khởi tạo camera với mã định danh không trùng lặp (`camera_code`), tên hiển thị, vị trí (`location_id`), tầng (`floor_id`) và kiểu nguồn (`stream_source_type`: `RTSP`, `VIDEO_FILE`, `WEBCAM`).
- **Mã hóa URL RTSP**: Mật khẩu trong RTSP URL được mã hóa **AES-256-GCM** trước khi lưu vào MongoDB. Mọi phản hồi API ra ngoài đều được che dấu dạng `url_rtsp_masked` (`rtsp://admin:*****@ip:port/stream`).
- **Trạng thái ban đầu**: `INACTIVE` (chưa kiểm tra kết nối) hoặc `READY` (đã probe thành công).

```mermaid
flowchart TD
    Start([Nhập thông tin Camera]) --> Val{Dữ liệu hợp lệ?}
    Val -- Sai --> ErrForm[Báo lỗi Validation]
    Val -- Đúng --> CheckDup{Trùng camera_code?}
    CheckDup -- Trùng --> ErrDup[Lỗi 409: CAMERA_CODE_EXISTS]
    CheckDup -- Không --> Encrypt[Mã hóa URL AES-256-GCM & Che mật khẩu masked]
    Encrypt --> Save[Lưu MongoDB: status = READY / INACTIVE]
    Save --> Done([Tạo thành công 201 Created])
```

---

### 2.2 Stream Connectivity Probe (Kiểm tra kết nối)
- **Thăm dò kết nối**: Kiểm tra tính khả dụng của luồng RTSP với ngưỡng timeout 4000ms trước khi lưu cấu hình.
- **Trích xuất thông số kỹ thuật**: Tự động đọc độ phân giải (`width`, `height`), tần số khung hình (`fps`), và chuẩn nén (`codec`: H.264/H.265).
- **Snapshot Preview**: Trích xuất 1 khung hình mẫu dạng Base64/JPEG để người dùng kiểm tra góc quay và phục vụ căn chỉnh vùng không gian (Zone Calibration).

```mermaid
flowchart TD
    Start([Nhấn Test Connection]) --> Probe{Thăm dò RTSP với timeout 4s}
    Probe -- Thất bại / Timeout --> Err[Lỗi 422: RTSP_PROBE_FAILED]
    Probe -- Thành công --> Extract[Đọc resolution, fps, video codec]
    Extract --> Snap[Chụp snapshot preview Base64]
    Snap --> Resp([Trả về 200 OK kèm metadata & ảnh preview])
```

---

### 2.3 AI Stream Orchestration (Điều phối luồng AI)
- **Khởi chạy luồng (START)**:
  - Chỉ cho phép khi camera ở trạng thái `READY` hoặc `STOPPED` (chặn nếu đang `STREAMING`).
  - Backend gọi `POST http://localhost:8000/api/v1/tracking/process`.
  - `MODULE_AI` tạo một tiến trình độc lập (`multiprocessing.Process`) chạy phát hiện và bám vết đối tượng, đẩy kết quả vào Redis Stream `tracking_events`.
  - Đồng bộ trạng thái camera thành `STREAMING` trong MongoDB và Redis key `camera:{id}:status`.
- **Dừng luồng (STOP)**:
  - Backend gọi `GET http://localhost:8000/api/v1/tracking/stopped?url_rtsp=...`.
  - `MODULE_AI` giải phóng process, Backend cập nhật trạng thái về `STOPPED`.

```mermaid
flowchart TD
    Req([Yêu cầu START / STOP]) --> Type{Loại lệnh?}
    
    Type -- START --> CheckSt{Trạng thái hiện tại?}
    CheckSt -- Đang STREAMING --> ErrActive[Lỗi 409: STREAM_ALREADY_ACTIVE]
    CheckSt -- READY / STOPPED --> CallStart[Gọi AI: POST /api/v1/tracking/process]
    CallStart --> StartOk{AI phản hồi?}
    StartOk -- Thành công --> SyncStream[Cập nhật MongoDB & Redis: STREAMING]
    StartOk -- Lỗi --> SyncErr[Cập nhật MongoDB: ERROR]

    Type -- STOP --> CallStop[Gọi AI: GET /api/v1/tracking/stopped]
    CallStop --> SyncStop[Cập nhật MongoDB & Redis: STOPPED]
    SyncStop --> EndStop([Hoàn tất dừng stream])
    SyncStream --> EndStart([Hoàn tất bật stream])
```

---

### 2.4 Camera Inventory & Filtering (Quản lý kho & Lọc danh sách)
- **Phân trang**: Hỗ trợ `page`, `limit` (mặc định 10, tối đa 100).
- **Bộ lọc**: Lọc theo `location_id`, `status` (`READY`, `STREAMING`, `STOPPED`, `ERROR`), `stream_source_type` và tìm kiếm mờ (`search`) theo tên/mã camera.
- **Bảo mật**: Toàn bộ danh sách trả về đều sử dụng `url_rtsp_masked`.

```mermaid
flowchart TD
    Req([GET /api/v1/cameras?params]) --> Query[Xây dựng Filter Query: location, status, search]
    Query --> Exec[Chạy song song: Count & Find Pagination]
    Exec --> Mask[Che mật khẩu url_rtsp_masked trên từng camera]
    Mask --> Resp([Trả về 200 OK: danh sách items + meta phân trang])
```

---

### 2.5 Periodic Status Check & Health Monitoring (Kiểm tra trạng thái định kỳ)
- **Đồng bộ 3 chiều**: Giữ trạng thái nhất quán giữa Tiến trình AI (`MODULE_AI`) $\leftrightarrow$ Bộ nhớ đệm Redis (`camera:{id}:status`) $\leftrightarrow$ Cơ sở dữ liệu MongoDB.
- **Heartbeat Worker**: Background task trong Backend định kỳ (15s/lần) gọi `/api/v1/tracking/status` của các camera đang `STREAMING`. Nếu tiến trình AI đã chết bất thường, hệ thống tự phát hiện và kích hoạt Auto-Reconnection hoặc chuyển trạng thái sang `ERROR`.

```mermaid
flowchart TD
    Tick([Background Task định kỳ 15s]) --> List[Lấy danh sách camera STREAMING]
    List --> CheckAI{Gọi AI GET /tracking/status: Process còn sống?}
    CheckAI -- Còn sống --> Refresh[Gia hạn TTL key Redis camera:id:status]
    CheckAI -- Đã chết / Lỗi --> Recover[Chuyển trạng thái sang RECONNECTING hoặc ERROR]
    Recover --> Sync[Đồng bộ vào MongoDB & Redis, phát thông báo Alert]
```

---

### 2.6 Auto-Reconnection & Failover (Tự động kết nối lại)
- **Phát hiện gián đoạn**: Nhận biết khi luồng video bị mất gói tin hoặc ngắt kết nối quá 5s.
- **Exponential Backoff**: Tự động chuyển trạng thái sang `RECONNECTING`, thử lại tối đa 5 lần với thời gian chờ tăng dần: **2s, 4s, 8s, 16s, 32s**.
- **Xử lý thất bại**: Nếu sau 5 lần vẫn không kết nối được, tiến trình AI được hủy hoàn toàn, camera chuyển sang `ERROR`, lưu `last_error_message` và phát cảnh báo hệ thống.

```mermaid
flowchart TD
    Drop([Mất tín hiệu stream]) --> SetRecon[Đặt Redis: status = RECONNECTING]
    SetRecon --> Loop{Thử lại: lần n <= 5?}
    Loop -- Còn lượt --> Wait[Chờ 2^n giây theo Exponential Backoff]
    Wait --> Retry{Kết nối lại?}
    Retry -- Thành công --> Restore[Khôi phục status = STREAMING]
    Restore --> Done([Hoạt động bình thường])
    Retry -- Thất bại --> Loop
    Loop -- Hết 5 lần --> Fail[Chấm dứt Worker, gán status = ERROR]
    Fail --> Alert([Phát cảnh báo sự cố đến người quản trị])
```

---

### 2.7 Configuration Update & Lifecycle Safeguard (Cập nhật & An toàn vòng đời)
- **Cập nhật có bảo vệ**: Cho phép sửa tên, mô tả, vị trí. Tuyệt đối **chặn sửa URL RTSP khi camera đang `STARTING` hoặc `STREAMING`** (bắt buộc phải STOP trước).
- **An toàn khi xóa (Soft Deletion)**:
  - Chặn xóa camera đang stream (`CANNOT_DELETE_ACTIVE_STREAM`).
  - Khi xóa mềm (`is_active = false`, `status = ARCHIVED`), hệ thống tự động ngắt worker AI liên quan và chuyển các vùng phân tích (Zones) thuộc camera đó sang `INACTIVE`.

```mermaid
flowchart TD
    Action([Thao tác Quản trị]) --> Choice{Loại thao tác?}
    
    Choice -- SỬA CẤU HÌNH --> CheckEdit{Có sửa URL RTSP?}
    CheckEdit -- Không --> SaveMeta[Cập nhật metadata vào MongoDB]
    CheckEdit -- Có --> CheckRun{Đang STREAMING?}
    CheckRun -- Đang chạy --> BlockEdit[Lỗi 409: URL_IMMUTABLE_WHILE_STREAMING]
    CheckRun -- Đã dừng --> ProbeNew[Kiểm tra URL mới & Lưu MongoDB]

    Choice -- XÓA CAMERA --> CheckStream{Đang STREAMING?}
    CheckStream -- Có --> BlockDel[Lỗi 400: CANNOT_DELETE_ACTIVE_STREAM]
    CheckStream -- Không --> Archive[Gán is_active = false, status = ARCHIVED]
    Archive --> Cascade[Vô hiệu hóa Zones liên quan & Xóa cache Redis]
```

---

## 3. Máy Trạng Thái Camera (Lifecycle State Machine)

```mermaid
stateDiagram-v2
    [*] --> INACTIVE: Thêm mới chưa probe
    INACTIVE --> READY: Probe RTSP hợp lệ
    READY --> STARTING: Nhấn Bật Stream
    STARTING --> STREAMING: AI Worker khởi tạo thành công
    STREAMING --> RECONNECTING: Mất mạng / Frame Drop
    RECONNECTING --> STREAMING: Kết nối lại thành công
    RECONNECTING --> ERROR: Thất bại sau 5 lần thử
    STREAMING --> STOPPED: Nhấn Dừng Stream
    STOPPED --> READY: Reset / Sẵn sàng chạy lại
    ERROR --> READY: Probe lại URL thành công
    READY --> ARCHIVED: Xóa mềm
    STOPPED --> ARCHIVED: Xóa mềm
    ERROR --> ARCHIVED: Xóa mềm
```

| Trạng thái | Ý nghĩa | Cho phép Bật AI? | Cho phép Dừng AI? | Sửa URL RTSP? | Xóa camera? |
|---|---|:---:|:---:|:---:|:---:|
| `INACTIVE` | Mới tạo, chưa kiểm tra kết nối | ❌ | ❌ | ✅ | ✅ |
| `READY` | Luồng hợp lệ, sẵn sàng chạy | ✅ | ❌ | ✅ | ✅ |
| `STARTING` | Đang khởi tạo tiến trình AI | ❌ | ❌ | ❌ | ❌ |
| `STREAMING` | Đang nhận feed và AI đang xử lý | ❌ | ✅ | ❌ | ❌ |
| `RECONNECTING`| Mất mạng, đang thử kết nối lại | ❌ | ✅ | ❌ | ❌ |
| `STOPPED` | Đã dừng AI, camera ở chế độ nghỉ | ✅ | ❌ | ✅ | ✅ |
| `ERROR` | Lỗi kết nối hoặc tiến trình AI chết | ❌ | ❌ | ✅ | ✅ |
| `ARCHIVED` | Đã xóa mềm (ẩn khỏi danh sách) | ❌ | ❌ | ❌ | ❌ |

---

## 4. Dữ Liệu & Hợp Đồng Giao Tiếp (Technical Specifications)

### 4.1 Schema MongoDB (`spacelens_db.cameras`)

```typescript
interface ICamera {
  _id: string;                      // ObjectId / UUID
  camera_code: string;              // Mã duy nhất (Unique Index), VD: "CAM-01-ENTRANCE"
  name: string;                     // Tên camera, VD: "Camera Cửa Trước"
  description?: string;
  location_id: string;              // ID địa điểm/chi nhánh (Indexed)
  floor_id?: string;                // ID tầng
  
  stream_source_type: 'RTSP' | 'VIDEO_FILE' | 'WEBCAM';
  url_rtsp: string;                 // Mã hóa AES-256-GCM tại database
  url_rtsp_masked: string;          // Chuỗi hiển thị an toàn: "rtsp://user:***@host:port/..."
  
  resolution: { width: number; height: number };
  fps: number;
  codec?: string;                   // 'H264' | 'H265' | 'MJPEG'
  orientation: 'CEILING' | 'WALL' | 'ANGLED';
  snapshot_url?: string;            // Ảnh tham chiếu mới nhất
  
  status: 'INACTIVE' | 'READY' | 'STARTING' | 'STREAMING' | 'RECONNECTING' | 'STOPPED' | 'ERROR' | 'ARCHIVED';
  last_error_message?: string;
  
  ai_process_info?: {
    process_id?: number;            // PID tiến trình AI
    started_at?: Date;
    stopped_at?: Date;
  };
  
  is_active: boolean;               // Cờ xóa mềm (default: true)
  created_at: Date;
  updated_at: Date;
}
```

### 4.2 Cấu Trúc Redis Cache
- `camera:{id}:status` (`String`, TTL 24h): Trạng thái vận hành tức thời (`STREAMING`, `STOPPED`, `ERROR`).
- `camera:{id}:reconnect_count` (`Integer`, TTL 5m): Số lần đã tự kết nối lại của camera.

### 4.3 Giao Tiếp Backend Monolith $\rightarrow$ Tracking Service (`:8000`)
- **Khởi động stream**: `POST /api/v1/tracking/process` $\rightarrow$ Payload: `{"url_rtsp", "camera_id", "location_id"}`.
- **Dừng stream**: `GET /api/v1/tracking/stopped?url_rtsp={clean_url}`.
- **Kiểm tra trạng thái**: `GET /api/v1/tracking/status?url_rtsp={clean_url}`.

---

## 5. Danh Mục API (`MODULE_BE :3000`)

Tiền tố chung: `/api/v1/cameras` | Header: `Authorization: Bearer <JWT>`

| Phương thức | Endpoint | Chức năng chính | Quyền hạn |
|:---:|---|---|:---:|
| `POST` | `/api/v1/cameras` | Đăng ký mới camera | `Admin` |
| `POST` | `/api/v1/cameras/test-connection` | Thăm dò kết nối & snapshot preview | `Admin`, `Operator` |
| `POST` | `/api/v1/cameras/:id/start-stream` | Khởi chạy AI tracking | `Admin`, `Operator` |
| `POST` | `/api/v1/cameras/:id/stop-stream` | Dừng AI tracking | `Admin`, `Operator` |
| `GET` | `/api/v1/cameras` | Danh sách camera (phân trang, lọc) | `All Roles` |
| `GET` | `/api/v1/cameras/:id` | Chi tiết camera | `All Roles` |
| `PUT` | `/api/v1/cameras/:id` | Cập nhật thông tin (chặn sửa RTSP khi đang chạy) | `Admin`, `Operator` |
| `DELETE` | `/api/v1/cameras/:id` | Xóa mềm camera (chặn xóa khi đang chạy) | `Admin` |
| `GET` | `/api/v1/cameras/:id/snapshot` | Lấy ảnh snapshot mẫu hiệu chuẩn | `All Roles` |

---

## 6. Tiêu Chí Nghiệm Thu (Acceptance Criteria)

```gherkin
Feature: Quản lý Camera Monolith SpaceLens

  Scenario: Đăng ký camera mới thành công
    Given Người dùng có quyền "ADMIN" gửi thông tin camera hợp lệ
    When Gửi POST tới "/api/v1/cameras"
    Then Trả về 201 Created và mật khẩu trong cơ sở dữ liệu được mã hóa AES-256-GCM

  Scenario: Thăm dò stream RTSP trước khi kích hoạt
    When Gửi POST tới "/api/v1/cameras/test-connection" với URL hợp lệ
    Then Trả về 200 OK kèm thông số độ phân giải, FPS và ảnh snapshot preview Base64

  Scenario: Bật và Tắt luồng xử lý AI
    Given Camera ở trạng thái "READY"
    When Gửi POST tới "/api/v1/cameras/:id/start-stream"
    Then Trạng thái chuyển sang "STREAMING" và đồng bộ vào Redis
    When Gửi POST tới "/api/v1/cameras/:id/stop-stream"
    Then Trạng thái chuyển về "STOPPED" và AI giải phóng tiến trình

  Scenario: Tự phục hồi khi mất kết nối mạng
    Given Camera đang ở trạng thái "STREAMING" bị mất kết nối RTSP
    Then Camera chuyển sang "RECONNECTING" và thử lại theo cơ chế Exponential Backoff (tối đa 5 lần)
    And Nếu quá 5 lần không thành công, camera chuyển sang trạng thái "ERROR"

  Scenario: Bảo vệ an toàn cấu hình và xóa mềm
    Given Camera đang ở trạng thái "STREAMING"
    When Người dùng gửi yêu cầu sửa URL RTSP hoặc gửi yêu cầu DELETE xóa camera
    Then Hệ thống từ chối với mã lỗi 409 hoặc 400 nhằm bảo vệ an toàn luồng dữ liệu
```
