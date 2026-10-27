# ADR-001 – Tách Frontend (Next.js) và Backend (NestJS) thành hai ứng dụng riêng

| Trường | Nội dung |
|---|---|
| **Mã ADR** | ADR-001 |
| **Ngày** | 2026-10-28 |
| **Trạng thái** | Đã chấp thuận (Accepted) |
| **Tác giả** | Kiệt (Team Lead), Hùng (Backend/DevOps) |

---

## Bối cảnh (Context)

Dự án BrewLite cần xây dựng một ứng dụng web đặt nước cho quán nhỏ với giao diện mobile-first (Next.js) và logic nghiệp vụ phức tạp (xác thực JWT, xử lý đơn hàng, tích hợp thanh toán SePay). Nhóm gồm 6 thành viên với trình độ và chuyên môn khác nhau, cần chia việc song song hiệu quả.

Câu hỏi cần quyết định: **Nên tổ chức codebase theo kiểu nào?**
- **(A)** Monolithic fullstack: Next.js duy nhất, dùng API Routes cho toàn bộ logic backend.
- **(B)** Tách biệt: Next.js (frontend) + NestJS (backend API riêng), đặt trong cùng monorepo.
- **(C)** Microservices: nhiều service nhỏ, giao tiếp qua message queue.

---

## Quyết định (Decision)

Chọn **phương án (B): Monorepo với hai ứng dụng tách biệt** – Next.js tại `apps/web` và NestJS tại `apps/api`.

---

## Lý do (Rationale)

| Tiêu chí | (A) Next.js API Routes | **(B) Next.js + NestJS** | (C) Microservices |
|---|---|---|---|
| Phân công song song | Khó (chung 1 codebase) | ✅ Frontend / Backend tách rõ | Quá phức tạp |
| Type-safety toàn stack | Không rõ | ✅ TypeScript cả hai đầu | Phức tạp |
| Bảo mật logic nghiệp vụ | Logic lộ ở client bundle | ✅ Logic hoàn toàn ở server | ✅ |
| Khả năng mở rộng | Hạn chế | ✅ Có thể scale API độc lập | ✅ (quá mức cần) |
| Độ phức tạp vận hành | Thấp | Trung bình | Rất cao |
| Phù hợp nhóm sinh viên | Ổn | ✅ Phù hợp | Không phù hợp |

Ngoài ra, **NestJS** cung cấp kiến trúc module rõ ràng (Guards, Pipes, Interceptors, Decorators) phù hợp với yêu cầu RBAC và Idempotency đặc thù của đề bài.

---

## Hệ quả (Consequences)

**Tích cực:**
- Kiệt và thành viên frontend tập trung vào `apps/web` mà không bị xung đột với team backend.
- Hùng và nhóm backend xây dựng domain modules độc lập trong `apps/api`.
- Có thể triển khai frontend (Vercel) và backend (Render) trên nền tảng phù hợp riêng mỗi loại.
- API NestJS dễ dàng viết Unit Test và Integration Test thuần tuý (không phụ thuộc Next.js).

**Tiêu cực / Đánh đổi:**
- Cần cấu hình CORS cho phép `apps/web` gọi `apps/api`.
- Môi trường local cần chạy cả hai process (hoặc dùng `docker-compose`).
- Phải duy trì `.env` riêng cho mỗi app.

---

## Các phương án đã loại bỏ

- **(A) Next.js API Routes only:** Logic backend lẫn lộn với presentation layer, khó test riêng, không thể hiện rõ kiến trúc phân tầng theo yêu cầu môn học.
- **(C) Microservices:** Overhead vận hành quá lớn (message broker, service discovery) không phù hợp với quy mô nhóm 6 sinh viên và thời hạn môn học.

