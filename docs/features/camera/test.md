# Part 3: Test Specification & Acceptance Scenarios (Camera Management)

> **Feature ID:** `FEAT-CAMERA-01` | **Version:** `2.3.0`  
> **Related Documents:**  
> - [Product Backlog & Business Flow (backlog.md)](./backlog.md)  
> - [Data Architecture (data.md)](./data.md)

---

## 1. Test Matrix

| Test ID | Test Item | Level | Objective | Expected Outcome |
|:---:|---|:---:|---|---|
| **TC-01** | Valid Camera Registration | Integration | Register camera with valid details and RTSP credentials | HTTP 201; Stored URL encrypted with AES-256; Response returns `url_rtsp_masked` |
| **TC-02** | Duplicate Camera Code Rejection | Unit / API | Submit camera with pre-existing `camera_code` | HTTP 409 Conflict (`CAMERA_CODE_EXISTS`) |
| **TC-03** | Successful Stream Probe | Integration | Probe accessible RTSP feed within 4 seconds | HTTP 200; Returns `width`, `height`, `fps`, and Base64 snapshot |
| **TC-04** | Failed / Timeout Stream Probe | Unit / API | Probe unreachable IP or invalid authentication | HTTP 422 Unprocessable Entity within 4000ms |
| **TC-05** | Start AI Stream (START) | E2E | Activate stream from `READY` state | HTTP 200; AI spawns worker; MongoDB & Redis update to `STREAMING` |
| **TC-06** | Stop AI Stream (STOP) | E2E | Stop active stream in `STREAMING` state | HTTP 200; AI terminates worker; MongoDB & Redis update to `STOPPED` |
| **TC-07** | Pagination & Multi-filter Query | Integration | `GET /cameras?location_id=...&status=...&page=1&limit=10` | HTTP 200; Paginated items match criteria; Sensitive credentials masked |
| **TC-08** | Heartbeat Crash Detection | Worker Test | Worker process terminated unexpectedly from OS | Within 15s, background task detects desync and updates DB/Redis to `ERROR` |
| **TC-09** | Exponential Backoff Reconnection | Worker Test | Drop video network connection | Retries at 2s, 4s, 8s, 16s, 32s intervals; Marks `ERROR` after 5 failures |
| **TC-10** | Block RTSP Update While Streaming | API Safeguard | Send `PUT /cameras/:id` with new URL while `STREAMING` | HTTP 409 Conflict (`URL_IMMUTABLE_WHILE_STREAMING`) |
| **TC-11** | Block Camera Deletion While Streaming | API Safeguard | Send `DELETE /cameras/:id` while `STREAMING` | HTTP 400 Bad Request (`CANNOT_DELETE_ACTIVE_STREAM`) |
| **TC-12** | Soft Deletion & Cascade Invalidation | Integration | Send `DELETE /cameras/:id` when `STOPPED` | HTTP 200; `is_active = false`; Linked spatial zones marked `INACTIVE` |

---

## 2. Automated Acceptance Scenarios (Gherkin)

```gherkin
Feature: SpaceLens Camera Management Verification

  # -------------------------------------------------------------
  # Scenario 1: Camera Registration & Data Security
  # -------------------------------------------------------------
  Scenario: Successfully register a new camera with encrypted credentials
    Given An authenticated user with "ADMIN" role
    When Submitting a POST request to "/api/v1/cameras" with:
      | camera_code      | CAM-TEST-01                              |
      | name             | Main Entrance Camera                     |
      | location_id      | LOC-STORE-01                             |
      | url_rtsp         | rtsp://admin:SecretPass123@192.168.1.50:554/live |
    Then Response status code must be 201
    And Response field "data.status" must equal "READY"
    And Response field "data.url_rtsp_masked" must equal "rtsp://admin:*****@192.168.1.50:554/live"
    And The raw password "SecretPass123" must not be present in plaintext in MongoDB

  Scenario: Reject duplicate camera code
    Given A camera already exists with camera_code "CAM-TEST-01"
    When Submitting a POST request to "/api/v1/cameras" with camera_code "CAM-TEST-01"
    Then Response status code must be 409
    And Error code must equal "CAMERA_CODE_EXISTS"

  # -------------------------------------------------------------
  # Scenario 2: Stream Connectivity Probe
  # -------------------------------------------------------------
  Scenario: Probe an active RTSP stream successfully
    When Submitting a POST request to "/api/v1/cameras/test-connection" with a valid RTSP URL
    Then Response status code must be 200
    And Response body must contain valid "resolution.width", "resolution.height", "fps", and "codec"
    And Response field "snapshot_base64" must contain a valid Base64 image string

  Scenario: Fail stream probe on connection timeout
    When Submitting a POST request to "/api/v1/cameras/test-connection" with an unreachable URL
    Then Response status code must be 422
    And Error code must equal "RTSP_PROBE_FAILED"

  # -------------------------------------------------------------
  # Scenario 3: AI Stream Orchestration Lifecycle
  # -------------------------------------------------------------
  Scenario: Start and stop AI tracking stream
    Given A camera exists with id "cam_01" and status "READY"
    When Submitting a POST request to "/api/v1/cameras/cam_01/start-stream"
    Then Response status code must be 200
    And Camera status in MongoDB and Redis must transition to "STREAMING"
    
    When Submitting a POST request to "/api/v1/cameras/cam_01/stop-stream"
    Then Response status code must be 200
    And Camera status in MongoDB and Redis must transition to "STOPPED"

  # -------------------------------------------------------------
  # Scenario 4: Auto-Reconnection & Failover
  # -------------------------------------------------------------
  Scenario: Recover stream with exponential backoff on network drop
    Given A camera with id "cam_01" is currently "STREAMING"
    When Frame drop or RTSP socket disconnection occurs
    Then Redis status must change to "RECONNECTING"
    And The system must retry with backoff delays of 2s, 4s, 8s, 16s, and 32s
    And If all 5 retries fail, status must update to "ERROR"
    And The worker process must be terminated cleanly

  # -------------------------------------------------------------
  # Scenario 5: Configuration Safeguards & Safe Archival
  # -------------------------------------------------------------
  Scenario: Block RTSP modification and deletion while camera is streaming
    Given A camera with id "cam_01" has status "STREAMING"
    When Submitting a PUT request to update "url_rtsp"
    Then Response status code must be 409
    When Submitting a DELETE request to "/api/v1/cameras/cam_01"
    Then Response status code must be 400
    And Error code must equal "CANNOT_DELETE_ACTIVE_STREAM"

  Scenario: Soft-delete stopped camera and cascade zone deactivation
    Given A camera with id "cam_01" has status "STOPPED"
    When Submitting a DELETE request to "/api/v1/cameras/cam_01"
    Then Response status code must be 200
    And Camera record must have "is_active" = false and "status" = "ARCHIVED"
    And All linked spatial zones must transition to "INACTIVE"
```

---

## 3. Acceptance Checklist

- [ ] **Registration**: `camera_code` uniqueness enforced; passwords encrypted via AES-256-GCM.
- [ ] **Probe**: Verification response completes within $\le 4\text{ s}$.
- [ ] **AI Orchestration**: Isolated OS processes spawned on START and terminated on STOP.
- [ ] **Health Monitoring**: 15s background check detects desync and updates Redis/MongoDB.
- [ ] **Failover**: 5-step exponential backoff (2s–32s) triggers before transitioning to `ERROR`.
- [ ] **Safeguards**: Mutation of RTSP URL and deletion are strictly rejected while `STREAMING`.
- [ ] **Data Sanitization**: All public endpoints mask credentials using `url_rtsp_masked`.
