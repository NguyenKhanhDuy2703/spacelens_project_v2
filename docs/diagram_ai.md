# Sơ Đồ Hoạt Động & Kiến Trúc Dự Án

Tài liệu này cung cấp cái nhìn toàn cảnh về kiến trúc của toàn bộ dự án SpaceLens, cũng như luồng hoạt động chi tiết của từng service.

## 1. Sơ Đồ Kiến Trúc Tổng Thể Toàn Dự Án
Sơ đồ này thể hiện luồng dữ liệu đi từ Camera, qua các module AI, cho đến Backend và Database. Analytics Service được đóng gói thành một khối tổng quát.

```mermaid
flowchart TD
    Camera["RTSP IP Cameras / Video File"]
    
    subgraph MODULE_AI_TRACKING ["1. Tracking Service (GPU/CPU)"]
        direction TB
        StreamReader["StreamReader"]
        YOLO["YOLOv8 Detection"]
        Tracker["ByteTrack & OSNet Re-ID"]
        RedisPub["RedisPublisher"]
    end

    subgraph REDIS ["2. Message Broker (Redis)"]
        RedisQueueTracking[("Stream:<br/>'tracking_events'")]
        RedisQueueAnalytics[("Stream:<br/>'analytics_events'")]
    end
    
    subgraph MODULE_AI_ANALYTICS ["3. Analytics Service (CPU)"]
        direction TB
        RedisSub["Redis Subscriber"]
        Processor["Analytics Processor<br/>(Zone, Dwell Time, Heatmap)"]
        RedisPubAnalytics["RedisPublisher"]
    end
    
    subgraph MODULE_BE ["4. Backend API"]
        Backend["Node.js / Express"]
    end

    subgraph DATABASE ["5. Database"]
        MongoDB[("MongoDB")]
    end
    
    %% Connections
    Camera -->|"Video Stream"| StreamReader
    StreamReader --> YOLO
    YOLO --> Tracker
    Tracker -->|"Push JSON: ID, BBox, Time"| RedisPub
    
    RedisPub -->|"XADD Payload"| RedisQueueTracking
    RedisQueueTracking -->|"XREADGROUP Consume"| RedisSub
    
    RedisSub --> Processor
    Processor -->|"Analyzed Result"| RedisPubAnalytics
    
    RedisPubAnalytics -->|"XADD Event"| RedisQueueAnalytics
    RedisQueueAnalytics -->|"Consume Event"| Backend
    
    Backend -->|"Save Data"| MongoDB
```

## 2. Sơ đồ Tuần tự (Sequence Diagram) - Tracking Service
Sơ đồ này thể hiện rõ thứ tự các bước bên trong luồng xử lý nhận diện AI.

```mermaid
sequenceDiagram
    autonumber
    participant Client as API Client
    participant Config as settings (config.py)
    participant Router as tracking_router
    participant Process as StreamProcessor
    participant Reader as StreamReader
    participant Core as ObjectTracking
    participant OSNet as OSNetReID
    participant Redis as RedisPublisher/DB

    %% Bước 1: Load config
    Note over Config: Load biến môi trường từ .env
    Config-->>Router: Cung cấp cấu hình (Port, Redis URL)
    
    %% Bắt đầu trigger
    Client->>Router: POST /api/v1/tracking/process (url_rtsp)
    Router->>Process: Spawn (Tạo) tiến trình Process mới
    Router-->>Client: Trả về HTTP 200 OK ngay lập tức
    
    %% Bước 2 & 3: Khởi tạo trong Process mới
    activate Process
    Process->>Config: Đọc file cấu hình YAML của YOLO và ByteTrack
    Process->>Core: Khởi tạo ObjectTracking (YOLOv8 + ByteTrack)
    Process->>OSNet: Khởi tạo OSNetReID Model
    Process->>Reader: Khởi tạo StreamReader và kết nối RTSP
    
    %% Vòng lặp xử lý
    loop Vòng lặp liên tục (while True)
        Reader-->>Process: Lấy Frame mới (get_frame)
        Process->>Core: process_single_frame(frame)
        Core->>Core: YOLOv8 Detect -> Bounding Box
        Core->>Core: ByteTrack Match -> Track ID
        Core-->>Process: Trả về kết quả (Tracks)
        
        %% OSNet Re-ID Pipeline
        opt Cho mỗi Track
            Process->>Process: Bước 1: Kiểm tra Confirmed Track
            Process->>Process: Bước 2: Noise Filtering (Score, Area, Aspect Ratio)
            Process->>OSNet: Bước 3: Crop & Trích xuất Feature (Sharpness & Normalization)
            OSNet->>OSNet: Bước 4: Gộp Vector (5-10 frames, Tổng[Vector * Trọng số])
            OSNet-->>Process: Trả về Accumulated Vector
            
            Process->>Redis: Bước 5: Lấy các Vectors hiện có (vd: HGETALL)
            alt Similarity > 0.7
                Process->>Process: Gán final_track_id = ID cũ (Re-ID thành công)
                Process->>Redis: Refresh TTL cho ID cũ (gia hạn 30 phút)
            else Similarity <= 0.7
                Process->>Process: Gán final_track_id = ID mới (Người mới)
                Process->>Redis: Lưu Vector bằng HSET (track_id làm key) & Set TTL 30 phút
            end
        end
        
        %% Cơ chế Refresh TTL định kỳ
        opt Định kỳ (vd: mỗi 5-10s) cho các Track đang active
            Process->>Redis: Gửi lệnh EXPIRE gia hạn TTL 30 phút
        end
        
        %% Bước 4: Đẩy dữ liệu
        Process->>Redis: Đóng gói JSON và Publish
        Redis->>Redis: xadd vào Redis Stream ('tracking_events')
    end
    deactivate Process
```

## 3. Sơ đồ Khối (Flowchart / Activity Diagram) - Tích hợp Swimlane
Sơ đồ này nhấn mạnh vào luồng xử lý dữ liệu (Data flow) bao gồm pipeline 4 bước của OSNet.

```mermaid
flowchart TD
    subgraph Client ["Client / API Gateway"]
        Start(["API POST /process"])
    end
    
    subgraph Router ["Tracking Router"]
        LoadConfig["1. Load Config từ env/yaml"]
        SpawnProcess["2. Tạo Process xử lý độc lập"]
    end
    
    subgraph PROCESS ["3. StreamProcessor (Background Process)"]
        InitModel["Khởi tạo ObjectTracking<br/>(YOLOv8 + ByteTrack)"]
        InitOSNet["Khởi tạo OSNetReID"]
        InitStream["Khởi tạo StreamReader"]
        
        LoopStart{"Còn Frame?"}
        
        ReadFrame["Lấy Frame từ Queue"]
        YOLO["YOLOv8 Detection"]
        ByteTrack["ByteTrack Tracking"]
        
        %% OSNet Re-ID Integration
        CheckConfirm{"B1: Confirmed<br/>Track?"}
        Filter{"B2: Lọc Nhiễu<br/>(Score/Area/Ratio)"}
        Extract["B3: Crop & Trích xuất Feature<br/>(Sharpness & Normalization)"]
        Weighting["B4: Gộp Vector (5-10 frames)<br/>Vector = Tổng(Vector * Trọng số)"]
        CheckReID{"B5: Đã đủ frames?<br/>So sánh DB"}
        
        ReIDSuccess["Gán ID Cũ (Re-ID)<br/>& Refresh TTL 30 phút"]
        ReIDFail["Gán ID Mới &<br/>Lưu Redis HSET (TTL 30 phút)"]
        
        PackJSON["Đóng gói dữ liệu JSON"]
        CheckRefresh{"Định kỳ 5-10s?"}
        RefreshTTL["Gửi lệnh EXPIRE<br/>gia hạn TTL 30 phút"]
        EndNode(["Dọn dẹp & Dừng"])
    end
    
    subgraph Redis ["4. Redis (Message Broker & DB)"]
        RedisDB[("Redis DB<br/>(HSET Vectors & TTL)")]
        RedisPub[["RedisPublisher<br/>(Stream 'tracking_events')"]]
        RedisAnalyticsStream[["Redis Stream<br/>('analytics_events')"]]
    end
    
    subgraph Analytics ["5. Analytics Service (Consumer)"]
        ConsumeStream[/"Đọc luồng Tracking<br/>(XREADGROUP)"/]
        DecodeJSON["Giải mã JSON & Lấy Tọa độ"]
        
        ZoneAnalyze("Zone Analysis<br/>(ENTRY / EXIT)")
        DwellAnalyze("Dwell Time Analysis<br/>(IoU / Đứng lâu)")
        HeatmapAnalyze("Heatmap Analysis<br/>(Tích lũy / Làm nguội)")
        
        PackResult{"Có sự kiện<br/>mới không?"}
        RedisPubAnalytics[/"Publish kết quả<br/>về Redis"/]
        DropEvent(["Bỏ qua"])
    end

    %% --- CONNECTIONS ---
    Start --> LoadConfig
    LoadConfig --> SpawnProcess
    SpawnProcess --> InitModel
    
    InitModel --> InitOSNet
    InitOSNet --> InitStream
    InitStream --> LoopStart
    
    LoopStart -->|"Có"| ReadFrame
    LoopStart -->|"Không (Mất kết nối)"| EndNode
    
    ReadFrame --> YOLO
    YOLO --> ByteTrack
    
    ByteTrack --> CheckConfirm
    CheckConfirm -->|"Không"| PackJSON
    CheckConfirm -->|"Có"| Filter
    
    Filter -->|"Không Đạt"| PackJSON
    Filter -->|"Đạt"| Extract
    
    Extract --> Weighting
    Weighting --> CheckReID
    
    CheckReID -->|"Chưa đủ"| PackJSON
    CheckReID -->|"> 0.7"| ReIDSuccess
    CheckReID -->|"<= 0.7"| ReIDFail
    
    ReIDSuccess -.->|"Tương tác DB"| RedisDB
    ReIDFail -.->|"Tương tác DB"| RedisDB
    
    ReIDSuccess --> PackJSON
    ReIDFail --> PackJSON
    
    PackJSON --> CheckRefresh
    CheckRefresh -->|"Có"| RefreshTTL
    CheckRefresh -->|"Không"| RedisPub
    
    RefreshTTL -.->|"Gia hạn DB"| RedisDB
    RefreshTTL --> RedisPub
    
    RedisPub -->|"XADD"| LoopStart
    
    %% Analytics Flow
    RedisPub -.->|"Gửi sự kiện qua Stream"| ConsumeStream
    ConsumeStream --> DecodeJSON
    
    %% Tỏa nhánh xử lý song song
    DecodeJSON --> ZoneAnalyze & DwellAnalyze & HeatmapAnalyze
    
    %% Gom kết quả
    ZoneAnalyze & DwellAnalyze & HeatmapAnalyze --> PackResult
    
    PackResult -->|"Có"| RedisPubAnalytics
    PackResult -->|"Không"| DropEvent
    RedisPubAnalytics -.->|"XADD sự kiện phân tích"| RedisAnalyticsStream
```

## 4. Chú giải Chi tiết Các Bước (Pipeline OSNet Re-ID)

Bảng dưới đây giải thích chi tiết các bước được thể hiện trong hai sơ đồ trên, đặc biệt tập trung vào cơ chế Re-ID và tương tác với Redis:

| Bước | Tên Giai Đoạn | Mô tả Chi tiết |
| :--- | :--- | :--- |
| **B1** | **Kiểm tra Confirmed Track** | ByteTrack sẽ gán trạng thái cho mỗi bounding box. Chỉ các đối tượng có trạng thái `Confirmed` (tồn tại ổn định qua nhiều frame) mới được cho phép đi tiếp. |
| **B2** | **Lọc Nhiễu (Noise Filtering)** | Loại bỏ các bounding box kém chất lượng dựa trên: <br/>- **Score**: Độ tự tin của YOLO (VD: > 0.6).<br/>- **Area**: Diện tích box phải đủ lớn (tính bằng `width * height`).<br/>- **Ratio**: Tỉ lệ khung hình tính bằng `W/H` (chiều rộng / chiều cao của bounding box). |
| **B3** | **Crop & Trích xuất Feature** | Cắt hình ảnh đối tượng, đưa qua AI **OSNet** để lấy Feature Vector. Trải qua 2 bước nhỏ: <br/>1. **Sharpness**: Tính điểm độ nét của ảnh.<br/>2. **Normalization**: Chuẩn hóa điểm số này thành trọng số (weight). |
| **B4** | **Gộp Vector (Accumulation)** | Thu thập và gộp vector của đối tượng qua **5 - 10 frames** để có vector ổn định nhất. Công thức: `Vector cuối cùng = Tổng các (Vector khung hình * Trọng số)`. |
| **B5** | **So sánh & Lưu trữ (Redis)** | Khi đã gộp đủ frames (qua B4). Lấy các vector trong Redis (bằng `HGETALL`) để tính khoảng cách Cosine: <br/>- **> 0.7**: Là người cũ. Lấy lại ID cũ và gia hạn thời gian sống (TTL) thêm 30 phút. <br/>- **<= 0.7**: Là người mới. Tạo ID mới, lưu Vector vào Redis dưới dạng `HashSet (HSET)` và đặt TTL 30 phút. |
| **Refresh** | **Gia hạn TTL Định kỳ** | Trong quá trình hệ thống đang tracking liên tục, một tiến trình phụ sẽ định kỳ (VD: 5-10s) gọi lệnh `EXPIRE` lên Redis để liên tục làm tươi thời gian sống cho các ID đang hiện diện trên camera, đảm bảo họ không bị Redis xóa nhầm khi đang đứng trước ống kính lâu hơn 30 phút. |
| **Publish** | **Đóng gói JSON & Gửi luồng** | Sau khi chốt được `final_track_id` cho khung hình hiện tại, hệ thống sẽ gom toàn bộ thông tin của đối tượng (bao gồm: `track_id`, tọa độ bounding box, confidence score, class, timestamp,...) thành định dạng JSON và đẩy lên Redis Stream để các dịch vụ khác (như UI, Analytics) tiêu thụ. |

## 5. Phân Tích Sơ Bộ Analytics Service (Module Phân Tích Hành Vi)

Do phần Analytics Service đang trong quá trình nghiên cứu, sơ đồ kiến trúc chỉ thể hiện dưới dạng một khối tổng quát. Dưới đây là phân tích sơ bộ các khối logic bên trong để phục vụ cho việc hoàn thiện sau này:

### A. Các Khối Nghiệp Vụ Chính
1. **Zone Analysis (Vùng Giám Sát & Đếm Người):** Nhận tọa độ đối tượng (point) và kiểm tra tương quan với các đa giác (Polygon). Tự động sinh ra các sự kiện: `ENTRY` (đi vào), `EXIT` (đi ra), `TRANSITION` (chuyển vùng). Đây là cơ sở cốt lõi để làm biểu đồ lưu lượng ra vào (People Counting).
2. **Dwell Time Analysis (Phân Tích Dừng Đỗ):** Sử dụng **IoU** (Intersection over Union) giữa 2 bounding box ở các frame liên tiếp để xác định đối tượng có di chuyển hay không. Nếu đứng yên (IoU > 0.7) quá ngưỡng thời gian quy định (VD: 2.0s), hệ thống sẽ gửi event cảnh báo (`ping` hoặc `stop`). Thuật toán IoU được tăng tốc (JIT compile) bằng thư viện `numba` giúp giảm tải CPU.
3. **Heatmap Analysis (Bản Đồ Nhiệt):** Chia không gian camera thành một ma trận lưới (Grid). Mỗi khi có người đi qua, cell tương ứng cộng thêm cường độ nhiệt. Sử dụng hệ số làm nguội (Decay = 0.99998) để hạ nhiệt từ từ các khu vực không còn người.

