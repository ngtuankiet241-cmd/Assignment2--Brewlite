# ADR-004 – Kiểm soát Idempotency cho luồng thanh toán

| Trường | Nội dung |
|---|---|
| **Mã ADR** | ADR-004 |
| **Ngày** | 2026-10-28 |
| **Trạng thái** | Đã chấp thuận (Accepted) |
| **Tác giả** | Hùng (Backend/DevOps), Kiệt (Team Lead) |

---

## Bối cảnh (Context)

Luồng đặt đơn và thanh toán của BrewLite có nguy cơ **double-submit** (xử lý trùng lặp) trong các tình huống:

1. **Người dùng nhấn "Xác nhận đặt hàng" hai lần** do ứng dụng phản hồi chậm.
2. **Mạng không ổn định:** Request gửi lần đầu timeout ở client nhưng server đã xử lý xong; client tự retry → server xử lý lần hai.
3. **Webhook IPN từ SePay bị gửi lại** (SePay có cơ chế retry IPN nếu server trả về non-2xx).

Hậu quả nếu không xử lý:
- **Tạo đơn trùng:** Cùng giỏ hàng tạo ra hai `Order` → trừ kho hai lần.
- **Thanh toán trùng:** Khách bị trừ tiền hai lần cho cùng một đơn (FR-21).

---

## Quyết định (Decision)

Áp dụng **Idempotency Key pattern** cho hai endpoint nhạy cảm:
- `POST /orders` – Tạo đơn hàng
- `POST /payments/create` – Khởi tạo thanh toán

**Cơ chế:**
- Client gửi kèm header `Idempotency-Key: <uuid-v4>` do client sinh ra.
- Server lưu kết quả của request đầu tiên theo key này.
- Nếu nhận request trùng key: trả về **kết quả đã lưu** thay vì xử lý lại.

---

## Lý do (Rationale)

### So sánh các phương án

| Phương án | Mô tả | Đánh giá |
|---|---|---|
| **(A) Không xử lý** | Để mặc tự nhiên | ❌ Rủi ro tạo đơn / trừ tiền trùng |
| **(B) Disable nút UI** | Disable nút sau khi nhấn lần đầu | ⚠️ Chỉ ngăn ở frontend, không ngăn được retry tự động hoặc tấn công |
| **(C) Unique Constraint DB** | Unique index trên một trường nghiệp vụ | ⚠️ Khó xác định trường nào duy nhất cho "cùng giỏ hàng" |
| **(D) Idempotency Key** | Client sinh UUID, server lưu + kiểm tra | ✅ Chuẩn công nghiệp, xử lý triệt để cả retry tự động và IPN |

Phương án **(D)** là chuẩn được Stripe, PayPal và các cổng thanh toán lớn áp dụng. Phù hợp với yêu cầu FR-21 và đảm bảo đúng kể cả khi có retry từ network layer.

---

## Thiết kế cụ thể

### Luồng Client → Server

```
Client (Next.js)                     NestJS API
    │                                     │
    │  idempotencyKey = uuidv4()          │
    │  POST /orders                       │
    │  Idempotency-Key: <key>  ─────────►│
    │                                     │── IdempotencyMiddleware kiểm tra DB/Cache
    │                                     │   Nếu key chưa tồn tại:
    │                                     │     → Xử lý tạo đơn bình thường
    │                                     │     → Lưu { key, response, status } vào DB
    │◄─ 201 Created { orderId } ──────── │
    │                                     │
    │  [Retry do timeout]                 │
    │  POST /orders                       │
    │  Idempotency-Key: <key> ──────────►│
    │                                     │── IdempotencyMiddleware tìm thấy key trong DB
    │◄─ 201 Created { orderId } ──────── │   → Trả về response đã lưu, KHÔNG tạo đơn mới
```

### Schema Prisma – Bảng `IdempotencyRecord`
```prisma
model IdempotencyRecord {
  id         String   @id @default(uuid())
  key        String   @unique          // Idempotency-Key từ header
  endpoint   String                   // "POST /orders" hoặc "POST /payments/create"
  userId     String                   // Chủ sở hữu (ngăn key bị dùng chéo user)
  statusCode Int                      // HTTP status code đã trả về
  response   Json                     // Body response đã lưu
  createdAt  DateTime @default(now())
  expiresAt  DateTime                 // TTL: 24 giờ sau khi tạo
}
```

> **Lưu ý bảo mật:** `userId` được lấy từ JWT đã xác thực, không phải từ client. Cùng `Idempotency-Key` nhưng khác `userId` → xử lý như request mới (không cho phép "mượn" key của người khác).

### Xử lý Webhook IPN từ SePay

```
SePay                  NestJS API (POST /payments/ipn)
  │                         │
  │── IPN payload ─────────►│── Kiểm tra transactionId trong bảng Payment
  │                         │   Nếu Payment.status đã là SUCCESS:
  │◄── 200 OK ──────────── │     → Trả 200 OK ngay, KHÔNG cập nhật lại
  │                         │   Nếu Payment.status = PROCESSING:
  │◄── 200 OK ──────────── │     → Cập nhật → SUCCESS, cập nhật Order → PAID
```

`Payment.transactionId` có **Unique Constraint** → không thể INSERT cùng transactionId hai lần → ngăn IPN retry gây duplicate record.

---

## Hệ quả (Consequences)

**Tích cực:**
- Loại bỏ hoàn toàn nguy cơ tạo đơn trùng và trừ tiền trùng (FR-21).
- Hoạt động đúng kể cả khi có network retry tự động (axios retry, SePay IPN retry).
- Có thể tái sử dụng middleware cho bất kỳ endpoint "write" nào trong tương lai.

**Tiêu cực / Đánh đổi:**
- Cần thêm bảng `IdempotencyRecord` và logic middleware.
- Client phải sinh và lưu `Idempotency-Key` trước khi submit form (UUID v4, dễ implement).
- Cần job dọn dẹp (cleanup) record đã hết TTL (24h) để bảng không phình to. *(Có thể dùng `pg_cron` hoặc NestJS scheduled task)*

---

## Quy ước áp dụng

1. **Client (Next.js):** Sinh `idempotencyKey = uuidv4()` khi user mở form checkout, lưu vào React state. Dùng lại key này cho mọi lần retry trong cùng phiên thanh toán.
2. **Server (NestJS):** `IdempotencyMiddleware` đọc header `Idempotency-Key`, kiểm tra DB, xử lý hoặc trả cache.
3. **TTL:** Bản ghi `IdempotencyRecord` hết hạn sau **24 giờ** – đủ để cover mọi retry hợp lệ mà không giữ dữ liệu vĩnh viễn.
4. **Scope key:** Mỗi key gắn với một `(userId, endpoint)` – không cho phép tái sử dụng chéo endpoint hay chéo user.

