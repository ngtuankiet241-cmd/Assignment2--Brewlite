# 📋 Bảng Phân công Nhiệm vụ & Theo dõi Tiến độ – BrewLite (Assignment 2)

Dự án môn **Công nghệ Phần mềm** gồm 6 thành viên, được tổ chức làm việc theo mô hình Agile/Scrum qua 5 Task chính từ Yêu cầu đến Triển khai.

---

## 👥 Danh sách Phân vai & Trách nhiệm Chính

| STT | Thành viên | MSSV | Vai trò chính | Nhiệm vụ chính xuyên suốt |
|:---:|---|:---:|---|---|
| 1 | **Kiệt** | 3124410175 | **Team Leader / Project Manager** | Quản lý tiến độ, điều phối Task, thiết lập Repository, Bối cảnh/Stakeholder/Rủi ro, Tổng hợp báo cáo LaTeX & Docs |
| 2 | **Luân** | 3124410204 | **Fullstack Developer** | Phụ trách SRS Sản phẩm & Giỏ hàng, Code giao diện Next.js, Class Diagram |
| 3 | **Hùng** | | **Backend / DevOps Engineer** | Phụ trách SRS Auth & Thanh toán SePay, Thiết kế API NestJS & Database Prisma, Deployment |
| 4 | **Triệu** | | **System Analyst / Designer** | Vẽ Sơ đồ Use-case tổng quát, Hỗ trợ Sequence Diagram, Thiết kế UI |
| 5 | **Lượng** | 3124410207 | **System Analyst / Backend** | Đặc tả chi tiết Use-case trọng tâm UC-01, Sequence Diagram cho checkout |
| 6 | **Kha** | | **QA / Business Analyst** | Rà soát Checklist chất lượng SRS, Yêu cầu Dữ liệu & Lưu trữ, Activity Diagram, Kiểm thử |

---

## 📅 Chi tiết Phân công theo Từng Giai đoạn (Tasks 1 → 5)

### Giai đoạn 1: Task 1 – Khai thác & Đặc tả Yêu cầu (2 điểm) ✅ [HOÀN THÀNH]
- **Kiệt:** Viết Bối cảnh nghiệp vụ, Bảng 6 Stakeholder, In-scope, Out-of-scope, Giả định, Ràng buộc, 6 Rủi ro ban đầu (`context-and-scope.md`). Setup repo và tổng hợp LaTeX.
- **Luân:** Soạn thảo 13 yêu cầu chức năng (FR-01 → FR-13) về Menu, Chi tiết món, Giỏ hàng và Trạng thái đơn.
- **Hùng:** Soạn thảo 8 yêu cầu chức năng (FR-14 → FR-21) về Auth JWT, Thanh toán mô phỏng SePay và 12 yêu cầu phi chức năng (NFR-01 → NFR-12).
- **Triệu:** Vẽ Sơ đồ Use-case tổng quát của toàn hệ thống (`use-case-tong-quat.jpg`).
- **Lượng:** Viết Bảng đặc tả Use-case trọng tâm UC-01 (11 bước luồng chính, luồng phụ, luồng lỗi) và vẽ sơ đồ UC-01 (`use-case-dat-thanh-toan.png`).
- **Kha:** Lập Bảng kiểm định chất lượng tài liệu đặc tả SRS (6 tiêu chuẩn ISO/IEEE), xác định yêu cầu lưu trữ dữ liệu (ACID, Concurrency, Idempotency).

---

### Giai đoạn 2: Task 2 – Mô hình hóa Hệ thống (2 điểm) 🎯 [ĐANG THỰC HIỆN]
- **Kha:** Vẽ **Activity Diagram** cho toàn bộ luồng nghiệp vụ từ Xem menu đến Nhận đơn (có Swimlanes, rẽ nhánh hết hàng, hủy thanh toán).
- **Triệu & Lượng:** Vẽ **Sequence Diagram** cho luồng Đặt và thanh toán UC-01 qua 5 lifeline (`Customer` -> `Next.js` -> `NestJS` -> `PostgreSQL` -> `SePay`).
- **Hùng & Luân:** Vẽ **Class Diagram** Domain Model (7 Entity: `User`, `Product`, `Order`, `OrderItem`, `Payment`, `Promotion`, `LoyaltyTransaction`).
- **Kiệt:** Review tính nhất quán giữa 3 sơ đồ với SRS Task 1, lưu file `.puml` vào `docs/diagrams/` và đưa vào LaTeX.

---

### Giai đoạn 3: Task 3 – Thiết kế Kiến trúc (2 điểm)
- **Hùng & Kiệt:** Viết mô tả kiến trúc phân tầng (Next.js PWA, NestJS Domain, PostgreSQL), viết các hồ sơ quyết định kiến trúc (ADR) trong `docs/architecture/adr/`.
- **Hùng:** Vẽ **Deployment Diagram** môi trường Production (HTTPS, Cloud host, Docker container, persistent DB storage).
- **Luân & Kha:** Cập nhật Ma trận truy vết (`traceability-matrix.md`) ánh xạ từ FR sang Diagram và Component.

---

### Giai đoạn 4: Task 4 – Triển khai Sprint 1 (2 điểm)
- **Kiệt:** Quản lý GitHub Issue Board, milestone Sprint 1 và branch protection rules.
- **Luân & Triệu:** Hiện thực giao diện Menu Next.js Mobile-first, trạng thái loading/empty/error.
- **Hùng & Lượng:** Cung cấp API `GET /products`, `GET /products/:id`, database seed script và unit test.
- **Kiệt & Hùng:** Xây dựng GitHub Actions CI Pipeline cơ bản (Lint, Test, Build).

---

### Giai đoạn 5: Task 5 – Triển khai Sprint 2, CI/CD & Delivery (2 điểm)
- **Cả nhóm:** Hoàn thiện luồng Giỏ hàng, Đặt đơn, Thanh toán SePay Sandbox, Lịch sử đơn.
- **Hùng & Kha:** Viết Unit Test, E2E Test, cấu hình `docker-compose.yml` và endpoint `/health`.
- **Kiệt & Hùng:** Hoàn thiện pipeline CD tự động triển khai lên nền tảng Cloud (Render/Railway), kiểm tra URL HTTPS Production.
- **Kiệt:** Quay video demo, tổ chức Sprint Retrospective và hoàn thiện báo cáo nghiệm thu.

---

## 📊 Ma trận Đánh giá Đóng góp Dự kiến (Contribution Matrix)

| Thành viên | Tỷ lệ đóng góp cam kết | Đánh giá hoàn thành Task 1 | Ghi chú |
|---|:---:|:---:|---|
| **Kiệt** (Lead) | 100% | Tốt (Đạt yêu cầu) | Hoàn thành Task 1.1, setup repo, dẫn dắt nhóm |
| **Luân** | 100% | Tốt (Đạt yêu cầu) | Hoàn thành SRS menu & giỏ hàng |
| **Hùng** | 100% | Tốt (Đạt yêu cầu) | Hoàn thành SRS auth & payment, NFRs |
| **Triệu** | 100% | Tốt (Đạt yêu cầu) | Hoàn thành Sơ đồ Use-case tổng quát |
| **Lượng** | 100% | Tốt (Đạt yêu cầu) | Hoàn thành Đặc tả use-case UC-01 chi tiết |
| **Kha** | 100% | Tốt (Đạt yêu cầu) | Hoàn thành Checklist chất lượng & Yêu cầu dữ liệu |
