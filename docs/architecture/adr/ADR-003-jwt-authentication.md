# ADR-003 – Xác thực bằng JWT Stateless

| Trường | Nội dung |
|---|---|
| **Mã ADR** | ADR-003 |
| **Ngày** | 2026-10-28 |
| **Trạng thái** | Đã chấp thuận (Accepted) |
| **Tác giả** | Hùng (Backend/DevOps), Kiệt (Team Lead) |

---

## Bối cảnh (Context)

BrewLite phân biệt hai nhóm người dùng:
- **Customer** – đặt đơn, xem lịch sử đơn của mình, thanh toán.
- **Staff** – cập nhật trạng thái đơn hàng (CONFIRMED → PREPARING → READY → COMPLETED / CANCELLED).

Hệ thống cần cơ chế xác thực (Authentication) và phân quyền (Authorization) để:
1. Xác nhận danh tính người dùng trên mỗi request API (FR-15, FR-17).
2. Ngăn Customer gọi endpoint dành riêng cho Staff (FR-12).
3. Ngăn Customer xem đơn hàng của người dùng khác (FR-13, NFR-03).

Câu hỏi cần quyết định: **Session-based hay Token-based (JWT)?**

---

## Quyết định (Decision)

Chọn **JWT Stateless** (JSON Web Token) với:
- **Access Token** (thời hạn ngắn: 15 phút – 1 giờ) chứa `userId`, `email`, `role`.
- **Lưu trữ phía client:** `localStorage` (web) hoặc `httpOnly cookie` (nâng cao tùy triển khai).
- **Thư viện:** `@nestjs/passport` + `passport-jwt` + `@nestjs/jwt`.
- **Bảo vệ endpoint:** `JwtAuthGuard` áp dụng globally, các route public dùng `@Public()`.

---

## Lý do (Rationale)

### Session-based vs JWT

| Tiêu chí | Session (Cookie + Redis) | **JWT Stateless** |
|---|---|---|
| Trạng thái server | ✅ Có thể revoke ngay | ✅ Không cần lưu state phía server |
| Scale ngang | Cần Redis share session | ✅ Stateless, scale dễ |
| Phù hợp REST API | Không tối ưu | ✅ Chuẩn REST |
| Phù hợp PWA / Mobile | Khó (cookie CORS) | ✅ Bearer token trên header |
| Độ phức tạp setup | Cần Redis | ✅ Đơn giản hơn |
| Revocation | ✅ Tức thời | ❌ Chỉ khi token hết hạn |

Trong phạm vi MVP của BrewLite, rủi ro không thể revoke JWT ngay lập tức là chấp nhận được. Thời hạn token ngắn (≤ 1 giờ) giảm thiểu rủi ro này.

---

## Thiết kế cụ thể

### Payload JWT
```json
{
  "sub": "user-uuid",
  "email": "user@example.com",
  "role": "CUSTOMER",
  "iat": 1730050000,
  "exp": 1730053600
}
```

### Luồng xác thực
```
Client                  NestJS API
  │                         │
  │── POST /auth/login ──►  │
  │                         │── Kiểm tra email + bcrypt verify password
  │                         │── Tạo JWT (sign với JWT_SECRET)
  │◄── { accessToken } ──── │
  │                         │
  │── GET /orders ─────────►│  Authorization: Bearer <token>
  │                         │── JwtAuthGuard → passport-jwt verify
  │                         │── Gắn req.user = { userId, email, role }
  │◄── [orders] ────────── │
```

### RBAC – Role-based Access Control
```typescript
// Endpoint chỉ dành cho STAFF
@Patch(':id/status')
@Roles(Role.STAFF)
@UseGuards(JwtAuthGuard, RolesGuard)
updateStatus(@Param('id') id: string, @Body() dto: UpdateStatusDto) { ... }

// Endpoint public (không cần JWT)
@Get()
@Public()
findAllProducts() { ... }
```

### Isolation dữ liệu khách hàng
Mọi query đơn hàng của Customer đều lọc theo `userId` lấy từ JWT đã xác thực:
```typescript
// OrdersService
findAll(userId: string) {
  return this.prisma.order.findMany({ where: { userId } });
}
```
→ Customer không thể xem đơn của người khác dù biết orderId.

---

## Hệ quả (Consequences)

**Tích cực:**
- Stateless: NestJS API có thể scale ngang mà không cần session store.
- Tích hợp tự nhiên với REST API và PWA frontend.
- `@nestjs/jwt` + `passport-jwt` cung cấp middleware sẵn, ít code boilerplate.

**Tiêu cực / Đánh đổi:**
- JWT không thể bị thu hồi trước khi hết hạn (nếu bị lộ token, phải chờ token expire).
  - **Biện pháp giảm thiểu:** Thời hạn access token ngắn (≤ 1 giờ); JWT Secret lưu biến môi trường, không commit vào git (NFR-05).
- `JWT_SECRET` phải đủ mạnh (≥ 32 ký tự ngẫu nhiên) và được rotate định kỳ nếu bị lộ.

---

## Quy ước áp dụng

1. `JWT_SECRET` được lưu trong `.env`, **không bao giờ** commit vào git.
2. Access Token có thời hạn `JWT_EXPIRES_IN=1h` (cấu hình qua `.env`).
3. `JwtAuthGuard` được đăng ký là **global guard** tại `AppModule`; chỉ những endpoint nào cần public mới dùng `@Public()`.
4. Không lưu thông tin nhạy cảm (mật khẩu, số thẻ) vào JWT payload.
5. Mọi lần login thất bại phải được log (NFR-06) nhưng **không log** password người dùng nhập vào.

