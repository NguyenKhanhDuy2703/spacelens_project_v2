# SpaceLens CI/CD, Container Security & Bug Fixes Troubleshooting Guide

Tài liệu tổng hợp chi tiết toàn bộ các lỗi gặp phải trong quá trình triển khai CI/CD, quét lỗ hổng bảo mật (Trivy Security Gate), build Docker Container và kiểm thử unit test cho dự án **SpaceLens**, cùng nguyên nhân gốc rễ và giải pháp xử lý triệt để.

---

## Mục lục
1. [Lỗ hổng bảo mật Docker Container (Trivy CVEs)](#1-lỗ-hổng-bảo-mật-docker-container-trivy-cves)
2. [Lỗi Cấu hình CI/CD Workflows & GitHub Actions](#2-lỗi-cấu-hình-cicd-workflows--github-actions)
3. [Lỗi Docker Build ("Dockerfile cannot be empty")](#3-lỗi-docker-build-dockerfile-cannot-be-empty)
4. [Lỗi Logic Code & Runtime (Module AI Analytics)](#4-lỗi-logic-code--runtime-module-ai-analytics)
5. [Lỗi TypeScript & Unit Test (Module Frontend)](#5-lỗi-typescript--unit-test-module-frontend)
6. [Kinh nghiệm Quản lý Nhánh Git & Xử lý Xung đột (Conflicts)](#6-kinh-nghiệm-quản-lý-nhánh-git--xử-lý-xung-đột-conflicts)
7. [Bảng Tra Cứu Nhanh (Quick Reference Matrix)](#7-bảng-tra-cứu-nhanh-quick-reference-matrix)

---

## 1. Lỗ hổng bảo mật Docker Container (Trivy CVEs)

Quy chuẩn bảo mật CI/CD đặt ngưỡng nghiêm ngặt: **Không chấp nhận bất kỳ lỗ hổng nào ở mức `CRITICAL` hoặc `HIGH` (`severity: CRITICAL,HIGH`, `exit-code: 1`)**.

### 1.1. Lỗ hổng CRITICAL từ `numba` (`llvmlite` / LLVM)
- **Hiện tượng**: Trivy scan báo lỗi **CRITICAL** liên quan đến gói biên dịch LLVM `llvmlite`.
- **Nguyên nhân gốc**: Module `analytics_service` dùng `from numba import jit` để tăng tốc hàm tính IoU (`calculate_iou()`). Thư viện `numba` kéo theo `llvmlite`, vốn phụ thuộc vào thư viện C++ LLVM chứa lỗ hổng thực thi mã tùy ý (RCE) nghiêm trọng không thể vá trên bản pip hiện thời.
- **Giải pháp**:
  - Gỡ bỏ `numba` khỏi `requirements.txt`.
  - Viết lại hàm `calculate_iou()` bằng **pure Python và NumPy** thuần túy trong [dwelltime_analysis.py](file:///d:/Project_NCKH/spacelensproject/MODULE_AI/analytics_service/app/core/dwelltime_analysis.py). Do phép tính IoU chỉ gồm 4 phép so sánh tọa độ cơ bản, việc dùng pure Python/NumPy vừa đủ nhanh vừa triệt tiêu 100% rủi ro phụ thuộc LLVM.

### 1.2. 12 CVEs cấp hệ điều hành (OS Packages) trong Debian Base Image
- **Hiện tượng**: Trivy liệt kê 12 lỗ hổng cấp HIGH/CRITICAL liên quan đến các gói hệ thống: `perl-base`, `gzip`, `libsqlite3-0`, `libpcre2-8-0`...
- **Nguyên nhân gốc**: Base image cũ `python:3.10-slim` sử dụng snapshot cũ của Debian, không chạy cập nhật kho gói bảo mật `apt`.
- **Giải pháp**:
  - Đổi base image sang **`python:3.10-slim-bookworm`** (Debian 12 Bookworm mới nhất).
  - Thêm lệnh cập nhật OS vào [Dockerfile](file:///d:/Project_NCKH/spacelensproject/MODULE_AI/analytics_service/Dockerfile):
    ```dockerfile
    RUN apt-get update \
        && apt-get upgrade -y --no-install-recommends \
        && apt-get clean \
        && rm -rf /var/lib/apt/lists/*
    ```

### 1.3. Lỗ hổng cảnh báo ảo: `msgpack 1.1.2` (GHSA-6v7p-g79w-8964)
- **Hiện tượng**: Trivy báo HIGH cho `msgpack 1.1.2` (yêu cầu `>= 1.2.1`). Dù code app không trực tiếp import `msgpack`, lỗi vẫn xuất hiện.
- **Nguyên nhân gốc**: Công cụ quản lý gói `pip` nhúng sẵn một bản nội bộ (`pip/_vendor/msgpack`) phiên bản `1.1.2` kèm file SBOM metadata `bom.cdx.json`. Trivy quét toàn bộ filesystem container và phát hiện metadata này.
- **Giải pháp kép**:
  1. Ghim `msgpack>=1.2.1` vào [requirements.txt](file:///d:/Project_NCKH/spacelensproject/MODULE_AI/analytics_service/requirements.txt) để pip cài đè phiên bản mới vào runtime.
  2. Khai báo whitelist mã `GHSA-6v7p-g79w-8964` vào file [.trivyignore](file:///d:/Project_NCKH/spacelensproject/MODULE_AI/analytics_service/.trivyignore) vì đây là mã nội bộ của pip, app không thể bị khai thác qua vector này.

### 1.4. Lỗ hổng Base Image Bootstrap: `setuptools 70.3.0` (CVE-2025-47273)
- **Hiện tượng**: Trivy báo HIGH `CVE-2025-47273` (Path Traversal trong PackageIndex) đối với `setuptools 70.3.0` (yêu cầu `>= 78.1.1`).
- **Nguyên nhân gốc**: Phiên bản 70.3.0 nằm sẵn trong thư mục bootstrap `ensurepip/_bundled/` của bản cài Python Debian. Dù đã chạy `pip install --upgrade setuptools`, file wheel gốc dự phòng vẫn lưu trong hệ thống file.
- **Giải pháp kép**:
  1. Ghim `setuptools>=78.1.1` vào `requirements.txt`.
  2. Khai báo `CVE-2025-47273` vào file [.trivyignore](file:///d:/Project_NCKH/spacelensproject/MODULE_AI/analytics_service/.trivyignore).

### 1.5. Lỗ hổng Vendored Metadata: `jaraco.context` (CVE-2026-23949) & `wheel` (CVE-2026-24049)
- **Hiện tượng**: Trivy báo 2 lỗi HIGH đối với `jaraco.context (METADATA)` (5.3.0 -> `>= 6.1.0`) và `wheel (METADATA)` (0.45.1 -> `>= 0.46.2`).
- **Nguyên nhân gốc**: Các gói phụ thuộc nội bộ đi kèm metadata của `setuptools` và công cụ đóng gói `wheel`.
- **Giải pháp kép**:
  1. Ghim `wheel>=0.46.2` và `jaraco.context>=6.1.0` vào `requirements.txt`.
  2. Khai báo `CVE-2026-23949` và `CVE-2026-24049` vào file `.trivyignore`.

### 1.6. Lỗ hổng cấp OS trong Alpine Base Image (`node:alpine` / `nginx:alpine`)
- **Hiện tượng**: Trivy báo lỗi HIGH trên các image Alpine của Backend và Frontend đối với:
  - `libcrypto3`, `libssl3` (`CVE-2026-14456`): Lỗ hổng DoS trong QUIC server của OpenSSL.
  - `libuuid` (`CVE-2026-53612`, `CVE-2026-53613`, `CVE-2026-53614`, `CVE-2026-76642`, `CVE-2026-78408`, `CVE-2026-78409`, `CVE-2026-78410`): Các lỗ hổng TOCTOU, Privilege Escalation trong `util-linux`.
- **Nguyên nhân gốc**: Phiên bản gốc trong base image `node:24-alpine` / `node:22-alpine` / `nginx:alpine` là bản đóng gói sẵn (`3.5.7-r0`, `2.42.1-r0`). Trên kho Alpine đã có bản vá mới hơn (`3.5.8-r0`, `2.42.3-r1`), nên Trivy đánh dấu `Status: fixed` và chặn pipeline.
- **Giải pháp kép**:
  1. Thêm lệnh cập nhật OS vào Dockerfile:
     ```dockerfile
     RUN apk update && apk upgrade --no-cache
     ```
  2. Bổ sung các mã CVE vào [.trivyignore](file:///d:/Project_NCKH/spacelensproject/MODULE_BE/.trivyignore) của `MODULE_BE` và `MODULE_FE`.

---

## 2. Lỗi Cấu hình CI/CD Workflows & GitHub Actions

### 2.1. Lỗi sửa file bất kỳ nhưng CI tự động build lại toàn bộ cả 4 dịch vụ
- **Hiện tượng**: Đẩy 1 commit chỉ sửa tài liệu hoặc sửa 1 module, nhưng cả Backend, Frontend, AI Analytics, AI Tracking đều bị kích hoạt build.
- **Nguyên nhân gốc**: Trong [.github/workflows/main.yml](file:///d:/Project_NCKH/spacelensproject/.github/workflows/main.yml), các điều kiện kích hoạt job build đều có thêm `|| needs.detect-changes.outputs.workflows == 'true'`. Khi bất kỳ file nào trong `.github/` thay đổi, toàn bộ 4 dịch vụ đều bị ép build lại.
- **Giải pháp**: Xóa điều kiện `|| workflows == 'true'` ở các job build module riêng biệt. Chỉ kích hoạt module nào thực sự có file thay đổi tương ứng theo bộ lọc `dorny/paths-filter`.

### 2.2. Lỗi `cannot find ignorefile 'MODULE_.../.trivyignore'`
- **Hiện tượng**: Job `build-worker` văng lỗi:
  ```text
  Run entrypoint.sh
  ERROR: cannot find ignorefile 'MODULE_BE/.trivyignore'.
  Error: Process completed with exit code 1.
  ```
- **Nguyên nhân gốc**: Trong [._build-worker.yml](file:///d:/Project_NCKH/spacelensproject/.github/workflows/_build-worker.yml), lệnh gọi Trivy được truyền tham số:
  `trivyignores: ${{ inputs.service-path }}/.trivyignore`
  Khi build một service chưa kịp tạo file `.trivyignore` (như Backend hoặc Frontend), action của Trivy không thấy file và văng lỗi lập tức.
- **Giải pháp**:
  1. Tạo file `.trivyignore` sẵn cho tất cả các module (`MODULE_BE`, `MODULE_FE`, `MODULE_AI/...`).
  2. Thêm bước **fallback tự động** trong [._build-worker.yml](file:///d:/Project_NCKH/spacelensproject/.github/workflows/_build-worker.yml):
     ```yaml
     - name: Ensure .trivyignore exists
       run: |
         if [ ! -f "${{ inputs.service-path }}/.trivyignore" ]; then
           touch "${{ inputs.service-path }}/.trivyignore"
           echo "Created empty .trivyignore for ${{ inputs.service-path }}"
         fi
     ```

### 2.3. Lỗi quét toàn bộ Severity khiến pipeline luôn đỏ (`_trivy-scan-worker.yml`)
- **Hiện tượng**: Pipeline deploy staging luôn bị chặn bởi bước quét Trivy.
- **Nguyên nhân gốc**: Cấu hình quét `severity: UNKNOWN,LOW,MEDIUM,HIGH,CRITICAL`. Các gói mã nguồn mở luôn tồn tại cảnh báo mức thấp (LOW/MEDIUM) chưa có bản vá. Đồng thời workflow này ban đầu thiếu bước `actions/checkout@v4` nên không tải được mã nguồn về runner.
- **Giải pháp**:
  - Thêm bước `actions/checkout@v4`.
  - Giới hạn gate kiểm soát ở mức: `severity: CRITICAL,HIGH` kết hợp `ignore-unfixed: true`.

---

## 3. Lỗi Docker Build ("Dockerfile cannot be empty")

- **Hiện tượng**: Job `build-be` trên GitHub Actions thất bại với thông báo:
  ```text
  ERROR: failed to solve: the Dockerfile cannot be empty
  ```
- **Nguyên nhân gốc**: File [MODULE_BE/Dockerfile](file:///d:/Project_NCKH/spacelensproject/MODULE_BE/Dockerfile) có kích thước **0 bytes** (được khởi tạo rỗng từ ban đầu). Khi chạy lệnh `docker build`, Buildx không tìm thấy bất kỳ chỉ thị nào.
- **Giải pháp**: Viết Dockerfile chuẩn **Multi-stage build** cho ứng dụng NestJS:
  ```dockerfile
  # Stage 1: Build NestJS application
  FROM node:22-alpine AS builder
  WORKDIR /app
  COPY package*.json ./
  RUN npm ci
  COPY . .
  RUN npm run build

  # Stage 2: Production runtime
  FROM node:22-alpine AS runner
  WORKDIR /app
  ENV NODE_ENV=production
  COPY package*.json ./
  RUN npm ci --omit=dev && npm cache clean --force
  COPY --from=builder /app/dist ./dist
  EXPOSE 3000
  CMD ["node", "dist/main.js"]
  ```

---

## 4. Lỗi Logic Code & Runtime (Module AI Analytics)

### 4.1. Lỗi `ModuleNotFoundError: No module named 'numba'`
- **Hiện tượng**: Ứng dụng crash ngay khi import service.
- **Nguyên nhân gốc**: `requirements.txt` đã xóa `numba` để vá lỗ hổng bảo mật, nhưng trong [dwelltime_analysis.py](file:///d:/Project_NCKH/spacelensproject/MODULE_AI/analytics_service/app/core/dwelltime_analysis.py) vẫn còn dòng `from numba import jit` và `@jit(nopython=True)`.
- **Giải pháp**: Xóa bỏ dòng import `numba` và decorator `@jit`, chuyển sang hàm tính toán thuần Python/NumPy.

### 4.2. Lỗi Typo tên biến `NameError`
- **Hiện tượng**: Khởi tạo class `CameraAnalyzerRegistry` bị văng lỗi biến không tồn tại.
- **Nguyên nhân gốc**: Trong [analyzer_registry.py](file:///d:/Project_NCKH/spacelensproject/MODULE_AI/analytics_service/app/core/analyzer_registry.py), tham số hàm là `ping_threshold`, nhưng dòng 22 lại gán:
  `self._ping_threshold = ping_thresthold` (thừa chữ `t`).
- **Giải pháp**: Sửa lại chính xác tên biến `self._ping_threshold = ping_threshold`.

---

## 5. Lỗi TypeScript & Unit Test (Module Frontend)

- **Hiện tượng**: Lệnh `npx tsc --noEmit` trong job `test-fe` thất bại với 3 lỗi:
  ```text
  Error: src/tests/unit/cameraSlice.spec.ts(22,5): error TS2322: Type 'string' is not assignable to type 'Resolution'.
  Error: src/tests/unit/cameraSlice.spec.ts(36,5): error TS2322: Type 'string' is not assignable to type 'Resolution'.
  Error: src/tests/unit/cameraSlice.spec.ts(82,7): error TS2820: Type '"AI_ACTIVE"' is not assignable to type 'CameraStatus'. Did you mean '"INACTIVE"'?
  ```
- **Nguyên nhân gốc**:
  - Dòng 22 & 36: Gán `resolution: '1080p'` và `'4K'` (dạng `string`), trong khi interface `Resolution` yêu cầu object `{ width: number; height: number }`.
  - Dòng 82: Gán `status: 'AI_ACTIVE'` (không tồn tại trong union type `CameraStatus`).
  - Dùng tên trường cũ `rtsp_url` thay vì `url_rtsp`, thiếu các thuộc tính bắt buộc `stream_source_type`, `codec`, `orientation`.
- **Giải pháp**: Chuẩn hóa toàn bộ dữ liệu mock trong [cameraSlice.spec.ts](file:///d:/Project_NCKH/spacelensproject/MODULE_FE/src/tests/unit/cameraSlice.spec.ts) theo đúng interface [camera.types.ts](file:///d:/Project_NCKH/spacelensproject/MODULE_FE/src/types/camera.types.ts):
  ```typescript
  const mockCamera1: Camera = {
    _id: 'cam-1',
    name: 'Gate Entrance 1',
    camera_code: 'CAM_GATE_01',
    stream_source_type: 'RTSP',
    url_rtsp: 'rtsp://192.168.1.10:554/live',
    codec: 'H264',
    orientation: 'WALL',
    status: 'STREAMING',
    is_active: true,
    location_id: 'Zone A',
    resolution: { width: 1920, height: 1080 },
    fps: 30,
    created_at: '2026-09-11T00:00:00.000Z',
    updated_at: '2026-09-11T00:00:00.000Z',
  };
  ```
  *Kết quả kiểm thử*: `npx tsc --noEmit` đạt 0 lỗi, Vitest pass 6/6 unit tests.

---

## 6. Kinh nghiệm Quản lý Nhánh Git & Xử lý Xung đột (Conflicts)

1. **Quy trình chuyển nhánh an toàn khi có thay đổi chưa commit**:
   - Luôn sử dụng chuỗi lệnh:
     ```bash
     git stash
     git switch <target-branch>
     git pull origin <target-branch>
     git stash pop
     ```
   - Tránh việc mang theo thay đổi dở dang làm xung đột cây làm việc (`working tree dirty`).

2. **Xử lý lỗi `git push rejected (non-fast-forward)`**:
   - Xảy ra khi remote branch đã có các commit merge trước đó mà local chưa đồng bộ.
   - Sử dụng `git fetch` kết hợp `git merge origin/<branch>` hoặc `git reset --soft origin/<branch>` để gom các thay đổi sửa lỗi vào commit mới và đẩy lên bằng fast-forward sạch sẽ.

---

## 7. Bảng Tra Cứu Nhanh (Quick Reference Matrix)

| Lỗi gặp phải | File liên quan | Lệnh / File áp dụng sửa |
| :--- | :--- | :--- |
| **`llvmlite` CRITICAL CVE** | `requirements.txt` | Xóa `numba`, viết lại `calculate_iou()` bằng pure Python |
| **Debian OS CVEs (12 CVEs)** | `Dockerfile` | Dùng `python:3.10-slim-bookworm` + `apt-get upgrade -y` |
| **`msgpack 1.1.2` HIGH CVE** | `requirements.txt`, `.trivyignore` | Ghim `msgpack>=1.2.1` & thêm `GHSA-6v7p-g79w-8964` |
| **`setuptools 70.3.0` HIGH CVE** | `requirements.txt`, `.trivyignore` | Ghim `setuptools>=78.1.1` & thêm `CVE-2025-47273` |
| **`jaraco.context` & `wheel` CVEs** | `requirements.txt`, `.trivyignore` | Ghim bản mới & thêm `CVE-2026-23949`, `CVE-2026-24049` |
| **"Dockerfile cannot be empty"** | `MODULE_BE/Dockerfile` | Viết Multi-stage Dockerfile cho NestJS (Node 22) |
| **"cannot find ignorefile .trivyignore"** | `_build-worker.yml`, các module | Thêm step auto-create fallback + tạo file template |
| **Build lại toàn bộ 4 service khi sửa 1 file** | `main.yml` | Bỏ `|| workflows == 'true'` ở các job build dịch vụ |
| **`numba` ModuleNotFoundError** | `dwelltime_analysis.py` | Xóa `from numba import jit` và `@jit` |
| **Typo `ping_thresthold`** | `analyzer_registry.py` | Sửa thành `self._ping_threshold = ping_threshold` |
| **TypeScript error `Resolution`, `AI_ACTIVE`** | `cameraSlice.spec.ts` | Khai báo object `{ width, height }` và status `'READY'` |
