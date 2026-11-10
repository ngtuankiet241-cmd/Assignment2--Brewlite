# 🚀 BrewLite – Release Notes v1.0.0 (Production Release)

> **Phiên bản:** `v1.0.0`  
> **Ngày phát hành:** 08/11/2026  
> **Người thực hiện:** Kiệt (Nhóm trưởng / Release Manager) & Đội ngũ BrewLite  
> **Môn học:** Công nghệ Phần mềm – Trường Đại học Sài Gòn  

---

## 📌 Tổng quan Bản phát hành

Bản phát hành **BrewLite v1.0.0** đánh dấu cột mốc hoàn thành toàn diện chu trình phát triển phần mềm từ Khai thác yêu cầu (Task 1), Mô hình hóa (Task 2), Thiết kế kiến trúc (Task 3), Triển khai Sprint 1 (Task 4) đến Đóng gói, Tích hợp CI/CD và Triển khai Production (Task 5).

Hệ thống đã sẵn sàng phục vụ khách hàng đặt thức uống trực tuyến không dùng tiền mặt với trải nghiệm mượt mà, an toàn và có độ tin cậy cao.

---

## ✨ Các Tính năng Chính Hoàn tất trong Sprint 2 (MVP Complete)

### 1. 📱 Frontend Web Application (Next.js 14+ PWA)
- **Thực đơn trực quan & Danh mục:** Xem danh sách đồ uống phân nhóm thông minh, hỗ trợ bộ lọc và tìm kiếm nhanh.
- **Tùy biến món (Customizer):** Lựa chọn kích cỡ ly (Size M, L), điều chỉnh mức đường/đá và chọn topping đa dạng.
- **Giỏ hàng thời gian thực (Cart Management):** Thêm, sửa số lượng, xóa món, tự động tính tổng tiền tức thì và lưu trữ phiên qua `localStorage`.
- **Luồng Đặt hàng (Checkout Flow):** Nhập thông tin người nhận, ghi chú pha chế, chọn hình thức nhận hàng (tại quán hoặc mang đi).
- **Cổng Thanh toán Không tiền mặt:** Tích hợp màn hình thanh toán mô phỏng SePay Sandbox qua mã QR chuyển khoản và thẻ ngân hàng.
- **Lịch sử & Trạng thái Đơn hàng:** Xem tiến trình chuẩn bị đơn hàng theo thời gian thực (`PENDING` $\rightarrow$ `PAID` $\rightarrow$ `PREPARING` $\rightarrow$ `COMPLETED`).

### 2. 🛡️ Backend RESTful API & Cơ sở Dữ liệu (NestJS 10 & PostgreSQL 16)
- **Xác thực & Phân quyền:** Đăng ký, đăng nhập tài khoản khách hàng, cấp phát JWT Token bảo mật theo chuẩn RFC 7519.
- **Xử lý Đơn hàng An toàn (ACID Transactions):** Đảm bảo tính nhất quán dữ liệu khi trừ số lượng tồn kho và tạo hóa đơn.
- **Cơ chế Chống Trùng lặp Thanh toán (Idempotency Key):** Bảo vệ các giao dịch thanh toán trực tuyến không bị trừ tiền hai lần khi người dùng ấn nhiều lần hoặc mạng chập chờn.
- **Webhook IPN (Instant Payment Notification):** Tự động nhận kết quả thanh toán từ SePay Sandbox, đối soát chữ ký số và cập nhật đơn hàng sang `PAID`.
- **Health Check Monitoring:** Endpoint `GET /health` giám sát liên tục kết nối cơ sở dữ liệu với ngưỡng phản hồi an toàn $< 1.000\text{ ms}$.

---

## 🔄 Tự động hóa CI/CD & Cơ sở Hạ tầng Cloud

- **Continuous Integration (CI):** Pipeline GitHub Actions tự động kiểm tra cú pháp (Lint), định kiểu (TypeScript), chạy Unit Test và Build ứng dụng trước khi sáp nhập vào `main`.
- **Continuous Delivery & Deployment (CD):** Tự động đóng gói Docker Images (`apps/api` và `apps/web`), tag theo commit SHA và semantic version, kích hoạt deploy lên nền tảng đám mây Render (Backend + Database) và Vercel (Frontend).
- **Safe Database Migration:** Chạy lệnh `prisma migrate deploy` cô lập trước khi chuyển hướng lưu lượng.
- **Post-deployment Smoke Testing:** Tự động gửi request kiểm tra tính sẵn sàng của hệ thống sau khi triển khai (`GET /health`).
- **Instant Rollback:** Quy trình khôi phục nhanh về phiên bản ổn định liền trước chỉ trong vòng dưới 2 phút khi phát hiện sự cố.

---

## 🌐 Liên kết Môi trường Production

| Thành phần | Nền tảng | URL Hoạt động | Ghi chú |
|---|---|---|---|
| **Frontend PWA** | Vercel Edge CDN | [https://brewlite.vercel.app](https://brewlite.vercel.app) | Giao diện Next.js bảo mật HTTPS |
| **Backend REST API** | Render PaaS | [https://brewlite-api.onrender.com/api](https://brewlite-api.onrender.com/api) | API dịch vụ cốt lõi |
| **Health Check** | Render API | [https://brewlite-api.onrender.com/health](https://brewlite-api.onrender.com/health) | Giám sát trạng thái hệ thống |
| **Database** | Render Managed PostgreSQL | *Private Network Only* | Bảo mật nội bộ, không mở Internet |
| **Kho mã nguồn** | GitHub | [https://github.com/ngtuankiet241-cmd/Assignment2--Brewlite](https://github.com/ngtuankiet241-cmd/Assignment2--Brewlite) | Mã nguồn mở và toàn bộ tài liệu |

---

## 📝 Quy ước Đánh dấu Phiên bản (Semantic Versioning)

Dự án tuân thủ nghiêm ngặt định dạng `vMAJOR.MINOR.PATCH`:
- `v1.0.0`: Phiên bản Production chính thức đầu tiên, hoàn tất trọn vẹn yêu cầu bài tập lớn Assignment 2.
- Các bản vá lỗi tiếp theo sẽ được phát hành dưới định dạng `v1.0.1`, `v1.0.2`.

