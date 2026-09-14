# Part 2: Data Architecture & State Design (Camera Management)

> **Feature ID:** `FEAT-CAMERA-01` | **Version:** `2.3.0`  
> **Primary Database:** MongoDB (`spacelens_db.cameras`) | **Cache:** Redis (`:6379`)  
> **Related Documents:**  
> - [Product Backlog & Business Flow (backlog.md)](./backlog.md)  
> - [Test Specification (test.md)](./test.md)

---

## 1. MongoDB Data Model (`spacelens_db.cameras`)

### 1.1 Field Specifications

| Field Name | Type | Required | Default | Description & Constraints |
|---|---|:---:|---|---|
| `_id` | `ObjectId` | Yes | Generated | Primary internal identifier |
| `camera_code` | `String` | Yes | None | Unique business identifier (e.g., `CAM-STORE01-01`), Unique Index |
| `name` | `String` | Yes | None | Human-readable camera display name |
| `description` | `String` | No | `null` | Optional description of position and coverage |
| `location_id` | `String` | Yes | None | Reference ID to store / warehouse (Indexed) |
| `floor_id` | `String` | No | `null` | Reference ID to floor / layout plan |
| `stream_source_type` | `String` | Yes | `'RTSP'` | Source format: `'RTSP'`, `'VIDEO_FILE'`, `'WEBCAM'` |
| `url_rtsp` | `String` | Yes | None | Raw RTSP URL, **must be encrypted at rest via AES-256-GCM** |
| `url_rtsp_masked` | `String` | Yes | None | Sanitized URL for public API responses (`rtsp://admin:***@ip:port/...`) |
| `resolution` | `Object` | Yes | `{}` | Stream dimensions: `{ width: Number, height: Number }` |
| `fps` | `Number` | Yes | `25.0` | Target frame rate verified during stream probe |
| `codec` | `String` | No | `'H264'` | Video codec: `'H264'`, `'H265'`, `'MJPEG'` |
| `orientation` | `String` | Yes | `'CEILING'` | Mounting perspective: `'CEILING'`, `'WALL'`, `'ANGLED'` |
| `snapshot_url` | `String` | No | `null` | Storage URL of latest calibration reference frame |
| `status` | `String` | Yes | `'INACTIVE'` | Operational lifecycle status (see section 3) |
| `last_error_message` | `String` | No | `null` | Details of the most recent operational error |
| `ai_process_info` | `Object` | No | `{}` | AI metadata: `{ process_id: Number, started_at: Date, stopped_at: Date }` |
| `is_active` | `Boolean` | Yes | `true` | Soft-deletion flag (`true`: active, `false`: archived) |
| `created_at` / `updated_at` | `Date` | Yes | `now()` | Auto-generated audit timestamps |

---

### 1.2 TypeScript Interface

```typescript
export interface ICamera {
  _id: string;
  camera_code: string;
  name: string;
  description?: string;
  location_id: string;
  floor_id?: string;
  
  // Connection details
  stream_source_type: 'RTSP' | 'VIDEO_FILE' | 'WEBCAM';
  url_rtsp: string;                 // Encrypted at rest (AES-256-GCM)
  url_rtsp_masked: string;          // Credentials masked for logs & UI
  
  // Video specifications
  resolution: {
    width: number;
    height: number;
  };
  fps: number;
  codec?: 'H264' | 'H265' | 'MJPEG';
  orientation: 'CEILING' | 'WALL' | 'ANGLED';
  snapshot_url?: string;
  
  // Operational state
  status: 'INACTIVE' | 'READY' | 'STARTING' | 'STREAMING' | 'RECONNECTING' | 'STOPPED' | 'ERROR' | 'ARCHIVED';
  last_error_message?: string;
  
  // AI runtime metadata
  ai_process_info?: {
    process_id?: number;
    started_at?: Date;
    stopped_at?: Date;
  };
  
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}
```

---

### 1.3 Database Indexes

```javascript
// Ensure uniqueness of camera business codes
db.cameras.createIndex({ camera_code: 1 }, { unique: true });

// Compound index for high-speed location filtering and pagination
db.cameras.createIndex({ location_id: 1, status: 1, is_active: 1 });

// Monitoring query index
db.cameras.createIndex({ status: 1 });
```

---

## 2. Redis Caching Architecture

Redis serves as the low-latency state cache ($<5\text{ ms}$) to support real-time status checks without stressing MongoDB:

| Key Format | Type | TTL | Purpose |
|---|---|---|---|
| `camera:{id}:status` | `String` | 86400s (24h) | Current operational status (`STREAMING`, `STOPPED`, `ERROR`, `RECONNECTING`) |
| `camera:{id}:reconnect_count` | `Integer` | 300s (5m) | Active retry attempt counter for exponential backoff |
| `camera:{id}:meta` | `Hash` | 3600s (1h) | Cached stream metadata: `fps`, `resolution`, `location_id` |

---

## 3. Lifecycle State Machine

### 3.1 State Transition Diagram

```mermaid
stateDiagram-v2
    [*] --> INACTIVE: Registered without verification
    INACTIVE --> READY: Probe passed successfully
    READY --> STARTING: User triggers Start Stream
    STARTING --> STREAMING: AI Worker successfully spawned
    STREAMING --> RECONNECTING: RTSP timeout / Frame drop
    RECONNECTING --> STREAMING: Reconnect succeeded
    RECONNECTING --> ERROR: All 5 retries exhausted
    STREAMING --> STOPPED: User triggers Stop Stream
    STOPPED --> READY: Reset / Ready for activation
    ERROR --> READY: Re-probe successful
    READY --> ARCHIVED: Soft-deleted
    STOPPED --> ARCHIVED: Soft-deleted
    ERROR --> ARCHIVED: Soft-deleted
```

### 3.2 Action Permission Matrix by State

| State | Start AI (`START`) | Stop AI (`STOP`) | Edit RTSP URL | Edit Name/Location | Delete Camera |
|---|:---:|:---:|:---:|:---:|:---:|
| `INACTIVE` | ❌ | ❌ | ✅ | ✅ | ✅ |
| `READY` | ✅ | ❌ | ✅ | ✅ | ✅ |
| `STARTING` | ❌ | ❌ | ❌ *(Blocked)* | ✅ | ❌ *(Blocked)* |
| `STREAMING` | ❌ | ✅ | ❌ *(Blocked)* | ✅ | ❌ *(Blocked)* |
| `RECONNECTING` | ❌ | ✅ | ❌ *(Blocked)* | ✅ | ❌ *(Blocked)* |
| `STOPPED` | ✅ | ❌ | ✅ | ✅ | ✅ |
| `ERROR` | ❌ | ❌ | ✅ | ✅ | ✅ |
| `ARCHIVED` | ❌ | ❌ | ❌ | ❌ | ❌ |

---

## 4. Security & Credential Masking

### 4.1 RTSP URL Encryption (AES-256-GCM)
- RTSP URLs typically contain sensitive credentials (`user:password`).
- Upon receipt, the Backend Monolith encrypts the URL using **AES-256-GCM** using `CAMERA_ENCRYPTION_KEY`.
- Stored payload contains initialization vector (`iv`), authentication tag (`authTag`), and ciphertext.

### 4.2 Credential Masking Rule
- All outbound API responses, audit events, and application logs must sanitize RTSP URLs:
  - **Raw:** `rtsp://admin:SecretPass123@192.168.1.120:554/live/ch0`
  - **Masked:** `rtsp://admin:*****@192.168.1.120:554/live/ch0`

---

## 5. AI Service Integration Contract

The Backend Monolith coordinates directly with `MODULE_AI/tracking_service` (`:8000`) over HTTP:

1. **Start Stream Call**:
   - `POST http://localhost:8000/api/v1/tracking/process`
   - Payload:
     ```json
     {
       "url_rtsp": "rtsp://admin:decrypted_pass@192.168.1.120:554/stream",
       "camera_id": "65e01234567890abcdef1234",
       "location_id": "LOC-STORE-001"
     }
     ```
   - Response: `{"status": "started", "pid": 14205}`

2. **Stop Stream Call**:
   - `GET http://localhost:8000/api/v1/tracking/stopped?url_rtsp={clean_url}`
   - Response: `{"message": "Process stopped"}`

3. **Status Health Check Call**:
   - `GET http://localhost:8000/api/v1/tracking/status?url_rtsp={clean_url}`
   - Response: `{"is_running": true, "pid": 14205, "fps": 24.8}`
