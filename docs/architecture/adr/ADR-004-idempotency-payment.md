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
- `POST /payments/sepay/checkout` – Khởi tạo thanh toán

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
    │                                     │── withIdempotency khóa key và kiểm tra DB
    │                                     │   Nếu key chưa tồn tại:
    │                                     │     → Xử lý tạo đơn bình thường
    │                                     │     → Lưu { scope, key, requestHash, response } cùng transaction
    │◄─ 201 Created { orderId } ──────── │
    │                                     │
    │  [Retry do timeout]                 │
    │  POST /orders                       │
    │  Idempotency-Key: <key> ──────────►│
    │                                     │── withIdempotency tìm thấy key trong DB
    │◄─ 201 Created { orderId } ──────── │   → Trả về response đã lưu, KHÔNG tạo đơn mới
```

### Schema Prisma – Bảng `IdempotencyRecord`
```prisma
model IdempotencyRecord {
  scope       String
  key         String
  requestHash String
  response    Json
  createdAt   DateTime @default(now())

  @@id([scope, key])
}
```

> **Triển khai 2026-11-15:** Dự án hỗ trợ checkout khách vãng lai nên key có phạm vi theo endpoint, không dựa vào `userId` trong body. Hash payload ngăn tái sử dụng key cho nội dung khác (`409`). Key không thay thế xác thực/phân quyền. PostgreSQL advisory lock theo endpoint/key và bản ghi trong cùng transaction bảo vệ cả request đồng thời, kể cả khi chỉ còn một sản phẩm. Request lỗi không lưu key; record thành công không tự hết hạn.

### Xử lý Webhook IPN từ SePay

```
SePay                  NestJS API (POST /payments/sepay/webhook-ipn)
  │                         │
  │── IPN payload ─────────►│── Khóa đơn và kiểm tra Payment
  │                         │   Nếu status, transactionRef, amount trùng:
  │◄── 201 Created ─────── │     → Trả payment cũ, KHÔNG cập nhật lại
  │                         │   Nếu giao dịch mới hợp lệ:
  │◄── 201 Created ─────── │     → Cập nhật → SUCCESS, cập nhật Order → PAID
```

`Payment.transactionRef` và `Payment.orderId` có **Unique Constraint**. Khóa đơn và transaction bảo đảm IPN lặp không ghi nhận thành công hoặc tiêu thụ tồn kho lần hai; callback lỗi không hạ trạng thái payment đã thành công.

---

## Hệ quả (Consequences)

**Tích cực:**
- Loại bỏ hoàn toàn nguy cơ tạo đơn trùng và trừ tiền trùng (FR-21).
- Hoạt động đúng kể cả khi có network retry tự động (axios retry, SePay IPN retry).
- Có thể tái sử dụng helper `withIdempotency` trong transaction của endpoint ghi khác.

**Tiêu cực / Đánh đổi:**
- Cần thêm bảng `IdempotencyRecord` và helper xử lý trong transaction.
- Client phải sinh và lưu `Idempotency-Key` trước khi submit form (UUID v4, dễ implement).
- Bản ghi tăng theo số key thành công. Hiện không tự xóa để tránh request cũ tạo đơn/giao dịch lại sau khi hết TTL; nếu bổ sung cleanup cần quy định rõ thời hạn bảo đảm chống lặp.

---

## Quy ước áp dụng

1. **Client (Next.js):** Sinh UUID trước submit, lưu cùng payload trong `sessionStorage` và ref. Dùng lại key cho retry/tải lại trang; đổi key khi payload đổi và xóa phiên sau hoàn tất.
2. **Server (NestJS):** Controller đọc `Idempotency-Key`; service gọi `withIdempotency` trong transaction trước thay đổi dữ liệu. Header cũ `X-Idempotency-Key` và body key của checkout vẫn được hỗ trợ.
3. **Replay:** Tạo đơn trả snapshot ban đầu. Checkout trả payment hiện tại mà không khởi tạo giao dịch lại; key cũ vẫn được ghi nhớ sau khi đổi key cho retry. Đơn hết hạn/hủy không được mở checkout lại.
4. **Scope/TTL:** Khóa chính `(scope, key)`, không tự hết hạn. Cùng key với payload khác trả `409`; key không hợp lệ hoặc mâu thuẫn header/body trả `400`. Client không gửi key vẫn hoạt động nhưng không có bảo đảm chống lặp theo key.
5. **Kiểm chứng:** [Test HTTP + PostgreSQL](../../../apps/api/test/idempotency.e2e-spec.ts), đặc biệt `INT-IDEM-01/02` và `INT-PAY-03`. Xem [hướng dẫn API](../../idempotency-api.md) để áp dụng migration và chạy test.

