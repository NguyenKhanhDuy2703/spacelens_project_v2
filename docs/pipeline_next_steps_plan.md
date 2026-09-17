# Kế Hoạch Triển Khai Tiếp Theo: Artifact, Security & E2E Pipeline

> **Ghi chú tiến độ:** Đã hoàn thành Giai đoạn 1 (Change Detection & Parallel Unit Test) và Giai đoạn 2 (Docker Multi-stage Build & Git SHA Tagging).

---

## 🧭 Kiến Trúc Cốt Lõi Được Chốt (Core Decision)

```
[Feature Branch / PR]
   Build Image ──> [Composite Action: Trivy Scan] ──> Push Image (Tag = Git SHA)
                     (Severity: CRITICAL, HIGH)
                                 │
                                 ▼
[Promote Cùng 1 Artifact - Build Once]
   dev ──> staging ──> [Composite Action: Full Trivy Scan] ──> main / production
                        (Severity: LOW, MEDIUM, HIGH, CRITICAL)  (Cùng digest, đã sạch)
```

> **Nguyên tắc vàng:** "Một logic scan dùng chung, khác nhau chỉ ở input — giảm complexity, tối ưu tốc độ, đảm bảo tính bất biến của Artifact qua từng môi trường."

---

## 📋 Danh Mục Các Bước Tiếp Theo (Checklist)

### 1. [ ] Bước A: Cơ Chế Xuất & Upload Docker Artifact (`.tar`)
- [ ] Cập nhật `_build-worker.yml`:
  - Khi `push-image: false` (vòng PR chạy E2E): xuất ra `outputs: type=docker,dest=/tmp/${service-name}.tar`.
  - Dùng `actions/upload-artifact@v4` đẩy file `.tar` lên GitHub Actions Pipeline (retention 1 ngày).
- [ ] Mục tiêu: Phục vụ riêng cho Job E2E tải về chạy container test tích hợp.

### 2. [ ] Bước B: Trivy Scan Qua Composite Action (Tiered Security)
- [ ] **Tạo Composite Action dùng chung:** `.github/actions/trivy-scan/action.yml`
  - Nhận input: `image-ref`, `severity` (mặc định: `CRITICAL,HIGH`), `exit-code: 1`.
  - Dùng `aquasecurity/trivy-action@master`.
- [ ] **Tầng 1 (Feature Branch / PR vào dev):**
  - Nhúng trực tiếp Composite Action vào `_build-worker.yml` ngay sau step Docker Build.
  - Quét nhanh ngay trên RAM/Local Docker của runner: `severity: CRITICAL,HIGH`.
  - Không tốn thời gian truyền file, fail-fast lập tức nếu có mã độc/CVE nghiêm trọng.
- [ ] **Tầng 2 (Release dev -> staging -> main):**
  - Tái sử dụng đúng Composite Action này ở Stage kiểm định Staging trước khi lên Production.
  - Quét toàn diện: `severity: LOW,MEDIUM,HIGH,CRITICAL`, kiểm tra Misconfiguration & Secret Leaks.

### 3. [ ] Bước C: E2E Smoke Test Pipeline (Môi Trường Thật)
- [ ] Viết kịch bản test smoke tối thiểu cho Backend trong `MODULE_BE/tests/e2e/` (kiểm tra server start và kết nối MongoDB thành công).
- [ ] Cấu hình Job `e2e-test` trong `main.yml`:
  - Bật service container `mongodb:7`.
  - Tải artifact BE `.tar` về, khởi chạy container `spacelens-be` kết nối tới MongoDB.
  - Chạy kịch bản E2E test vào `http://localhost:3000`.
  - Upload log / báo cáo test nếu gặp sự cố.

### 4. [ ] Bước D: Final Quality Gate & Branch Protection
- [ ] Thêm job `quality-gate` vào cuối `main.yml` với `needs: [...]` và `if: always()`.
- [ ] Tổng hợp trạng thái toàn bộ các tầng (Unit Test, Build, Trivy, E2E) thành bảng kết quả Markdown hiển thị ở GitHub Step Summary.
- [ ] Thiết lập GitHub Branch Protection Rule: Bắt buộc `quality-gate` phải xanh mới cho phép bấm **Merge** vào nhánh `dev`.

### 5. [ ] Bước E: Promotion & Deploy CD
- [ ] Khi commit được merge vào nhánh `main`/`dev`, tự động kích hoạt `push-image: true` đẩy image chính thức lên Docker Hub.
- [ ] Kích hoạt webhook hoặc deploy script lên môi trường thực tế.
