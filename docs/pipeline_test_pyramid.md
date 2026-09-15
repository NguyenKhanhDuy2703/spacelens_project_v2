# Kiến Trúc CI/CD Pipeline & Mô Hình Kim Tự Tháp Kiểm Thử (Test Pyramid)

> 📁 File vẽ Draw.io tương ứng: [`.temps/pipeline-test.drawio`](file:///d:/Project_NCKH/spacelensproject/.temps/pipeline-test.drawio) (mở trực tiếp bằng extension *Draw.io Integration* trong VS Code).

---

## 1. Sơ Đồ Tổng Thể Pipeline & Test Scope Mapping

```mermaid
flowchart TD
    classDef trigger fill:#3F3F46,stroke:#71717A,stroke-width:2px,color:#FFFFFF;
    classDef testLayer fill:#0369A1,stroke:#38BDF8,stroke-width:2px,color:#FFFFFF;
    classDef e2eLayer fill:#065F46,stroke:#34D399,stroke-width:2px,color:#FFFFFF;
    classDef artifactLayer fill:#581C87,stroke:#C084FC,stroke-width:2px,color:#FFFFFF;
    classDef approvalLayer fill:#7C2D12,stroke:#FB923C,stroke-width:2px,color:#FFFFFF;
    classDef scopeBox fill:#1E293B,stroke:#475569,stroke-width:1.5px,color:#F8FAFC,text-align:left;

    subgraph CI_PIPELINE ["Quy trình CI (Chạy khi Pull Request → dev)"]
        PR["Pull request → dev"]:::trigger
        S1["1. Static check<br/>Lint, build check, dependency scan"]:::trigger
        S2["2. Unit test<br/>Chạy song song theo module (FE & BE)"]:::testLayer
        S3["3. Integration test<br/>API & DB Service Container"]:::testLayer
        S4["4. E2E test (subset)<br/>Chạy nhanh, đủ smoke case"]:::e2eLayer
        GATE["Required status check → merge"]:::trigger

        PR --> S1 --> S2 --> S3 --> S4 --> GATE
    end

    subgraph CD_PIPELINE ["Quy trình CD (Chạy sau khi Merge vào dev)"]
        S5["Build artifact 1 lần<br/>Gắn tag/version, đẩy vào registry"]:::artifactLayer
        S6["Deploy staging (cùng artifact)<br/>Chạy full regression + E2E đầy đủ"]:::e2eLayer
        S7["Manual approval (ranh giới CD)<br/>Human Review Gate"]:::approvalLayer
        S8["Promote artifact → production<br/>Không build lại mã nguồn"]:::artifactLayer

        GATE --> S5 --> S6 --> S7 --> S8
    end

    subgraph TEST_PYRAMID_SCOPES ["Kim Tự Tháp Kiểm Thử (Test Pyramid & Scope)"]
        SCOPE_STATIC["<b>[Tầng 0 - Nền tảng] Static Check Scope:</b><br/>• Type-check (tsc --noEmit)<br/>• ESLint syntax & formatting<br/>• Quét bảo mật (npm audit / Trivy)<br/>⏱ ~30s | Chi phí: ~0"]:::scopeBox
        SCOPE_UNIT["<b>[Tầng 1 - Đáy tháp: 70%] Unit Test Scope:</b><br/>• FE: Redux slices, utilities, pure logic (Vitest)<br/>• BE: Service logic, math, mock mọi I/O (Jest)<br/>• Mock toàn bộ DB, Redis, external APIs<br/>⏱ ~1-2 phút | Chi phí: Rất thấp"]:::scopeBox
        SCOPE_INTEG["<b>[Tầng 2 - Thân tháp: 20%] Integration Test Scope:</b><br/>• Controller ↔ Service ↔ DB contract<br/>• Chạy với DB test container (Mongo, Redis)<br/>• Supertest gọi API endpoints<br/>⏱ ~2-3 phút | Chi phí: Trung bình"]:::scopeBox
        SCOPE_E2E_SUBSET["<b>[Tầng 3 - Cận đỉnh: 5%] E2E Subset (Smoke):</b><br/>• 3-5 kịch bản sống còn (Happy Paths)<br/>• Khởi động app → Đăng nhập → Tải Camera<br/>• Fail-fast trước khi merge<br/>⏱ ~2-3 phút | Chi phí: Cao"]:::scopeBox
        SCOPE_FULL_E2E["<b>[Tầng 4 - Đỉnh tháp: Toàn diện] Full Regression & Full E2E:</b><br/>• Chạy trên môi trường Staging thực tế<br/>• Mọi user flows, edge cases, cross-service<br/>• Tải baseline & xác nhận trước khi lên Prod<br/>⏱ ~10-20 phút | Chi phí: Cao nhất"]:::scopeBox
    end

    S1 -.-> SCOPE_STATIC
    S2 -.-> SCOPE_UNIT
    S3 -.-> SCOPE_INTEG
    S4 -.-> SCOPE_E2E_SUBSET
    S6 -.-> SCOPE_FULL_E2E
```

---

## 2. Bảng Phân Định Chi Tiết Test Scope Ở Từng Bước

| Bước trong Pipeline | Màu đại diện | Vị trí trong Tháp kiểm thử | Test Scope (Phạm vi kiểm thử) | Đặc điểm & Nguyên tắc |
| :--- | :--- | :--- | :--- | :--- |
| **1. Static check** | Xám | **Nền tảng mở rộng (Tầng 0)** | • **TypeScript:** Compile check không emit file (`tsc --noEmit`) nhằm phát hiện sai lệch kiểu dữ liệu.<br>• **Linter:** ESLint kiểm tra quy chuẩn coding conventions, import thừa, biến không dùng.<br>• **Security audit:** `npm audit` quét lỗ hổng bảo mật của dependencies cấp độ High/Critical. | **Fail-Fast**: Phát hiện lỗi cú pháp và lỗ hổng ngay trong 30 giây đầu tiên, chặn việc tiêu tốn tài nguyên server cho các bước test nặng phía sau. |
| **2. Unit test** | Xanh dương | **Đáy tháp (Tầng 1 - Chiếm 70%)** | • **Frontend Scope:** Kiểm thử Redux Toolkit slices (`cameraSlice.spec.ts`), action creators, helper functions, hooks thuần túy với Vitest.<br>• **Backend Scope:** Kiểm thử từng class/method trong service (`camera.service.spec.ts`), business rules.<br>• **Mocking:** Mock 100% database, redis, http requests. | **Chạy song song (Parallel):** Worker FE và Worker BE chạy đồng thời để tối ưu thời gian. Độ bao phủ lớn nhất nhưng chạy cực nhanh. |
| **3. Integration test** | Xanh dương | **Thân tháp (Tầng 2 - Chiếm 20%)** | • Kiểm thử liên kết giữa Controller ↔ Service ↔ Database / Cache.<br>• Kiểm tra validation pipes (class-validator), DTO mapping, Mongoose schema constraints.<br>• Sử dụng Service Containers (Redis, MongoDB In-Memory hoặc test container) trong runner. | Đảm bảo các mảnh ghép bên trong backend hoặc frontend khớp với nhau, bắt lỗi hợp đồng API mà unit test không thấy được. |
| **4. E2E test (subset)** | Xanh ngọc | **Cận đỉnh (Tầng 3 - Chiếm ~5%)** | • **Smoke Test Subset:** Chỉ kiểm tra các luồng nghiệp vụ cốt lõi sống còn (Happy Paths).<br>• Ví dụ: Render trang đăng nhập → Đăng nhập thành công → Gọi API lấy danh sách Camera hiển thị lên Grid.<br>• Bỏ qua các kịch bản ngoại lệ hoặc edge cases phức tạp. | **Pre-merge Gate:** Giữ thời gian chạy PR dưới 3 phút nhưng vẫn đảm bảo bản build không bị "vỡ vụn" (broken build) khi đưa vào `dev`. |
| **Required status check → merge** | Xám | **Cổng kiểm soát chất lượng** | • Tổng hợp kết quả từ Step 1 đến Step 4.<br>• Điều kiện tiên quyết: Cả 4 bước phải xanh lá (`success`) thì PR mới đủ điều kiện bấm Merge vào `dev`. | Bảo vệ nhánh `dev` luôn ở trạng thái buildable và runnable. |
| **Build artifact 1 lần** | Tím | **Đóng gói & Định danh** | • Build Docker image duy nhất cho từng service.<br>• Gắn tag phiên bản (Git SHA rút gọn, ví dụ `:dev-a1b2c3d`) và đẩy lên Container Registry (Docker Hub / GHCR). | **Build Once, Deploy Anywhere:** Đảm bảo artifact chạy trên Staging và Production là hoàn toàn đồng nhất 100%. |
| **Deploy staging (cùng artifact)** | Xanh ngọc | **Đỉnh tháp (Tầng 4 - Toàn diện)** | • Triển khai đúng Docker image vừa build lên server Staging.<br>• **Full Regression Test Suite:** Chạy toàn bộ các test case hồi quy.<br>• **Full E2E Test Suite:** Kiểm thử toàn diện mọi luồng nghiệp vụ, tương tác chéo giữa FE + BE + AI Services (Zone, Dwell time, Heatmap), edge cases, tải cơ bản. | Kiểm chứng độ tin cậy thực tế trên môi trường giống thật nhất trước khi đưa ra người dùng cuối. |
| **Manual approval** | Cam / Nâu | **Ranh giới CD (Human Gate)** | • Dừng pipeline chờ Tech Lead hoặc Release Manager xem xét báo cáo test Staging.<br>• Phê duyệt thủ công trên GitHub Environment (`production`). | Ranh giới an toàn ngăn chặn việc tự động deploy thẳng lên Production khi chưa có sự xác nhận của con người. |
| **Promote artifact → production** | Tím | **Triển khai Production** | • Lấy chính xác Docker image đã được verify trên Staging chuyển sang Production.<br>• **Tuyệt đối KHÔNG build lại mã nguồn** từ Git. | Giảm thiểu tối đa rủi ro cấu hình và đảm bảo tính nhất quán (Immutability). |

---

## 3. Cách Sử Dụng File Sơ Đồ `.drawio`

File [`docs/pipeline_test_pyramid.drawio`](./pipeline_test_pyramid.drawio) đã được thiết kế sẵn với:
1. **Giao diện chuẩn dark theme cao cấp** (`#0F172A`).
2. **Cột trái:** Pipeline Flow 10 bước bám sát 100% sơ đồ và màu sắc bạn đã cung cấp.
3. **Cột phải:** Mô hình Kim tự tháp kiểm thử với đầy đủ chi tiết Test Scope, tỷ trọng, thời gian và công cụ cho từng tầng.
4. **Đường gióng kết nối:** Mũi tên nét đứt (`dashed connectors`) liên kết trực quan từng step trong pipeline sang đúng tầng kiểm thử tương ứng.

### Các cách mở file:
* **Cách 1 (Ngay trong VS Code / IDE):** Cài extension **Draw.io Integration** (tác giả *Henning Dieterichs*) -> Nhấp đúp vào file [`docs/pipeline_test_pyramid.drawio`](./pipeline_test_pyramid.drawio) để xem và chỉnh sửa đồ hoạ trực tiếp.
* **Cách 2 (Trình duyệt web):** Truy cập [app.diagrams.net](https://app.diagrams.net) -> Chọn **Open Existing Diagram** -> Chọn file `pipeline_test_pyramid.drawio` trong thư mục `docs/`.
