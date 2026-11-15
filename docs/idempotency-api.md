# Idempotency cho đặt đơn và thanh toán

`POST /orders` và `POST /payments/sepay/checkout` nhận header `Idempotency-Key`. Client sinh UUID trước khi gửi, giữ nguyên key và payload khi retry do lỗi mạng/timeout. Một yêu cầu mới có chủ đích phải dùng key mới. Các client cũ không gửi key vẫn hoạt động nhưng không có bảo đảm chống lặp theo key.

Ví dụ tạo đơn (hai lần gửi nguyên request này trả cùng đơn, HTTP `201`):

```http
POST /orders
Content-Type: application/json
Idempotency-Key: 8c891c2b-9789-43e3-b52d-3d2309511184

{"customerName":"Nguyễn Văn A","customerPhone":"0900000000","items":[{"productId":"<product-id>","quantity":1}]}
```

Khởi tạo thanh toán với một key ổn định cho đơn đó:

```http
POST /payments/sepay/checkout
Content-Type: application/json
Idempotency-Key: payment-<order-id>

{"orderId":"<order-id>","amount":35000}
```

- Key gồm 1–255 ký tự ASCII hiển thị, không có khoảng trắng. Key rỗng/không hợp lệ trả `400`.
- Key có phạm vi theo endpoint. Cùng key nhưng payload khác trả `409`, không tạo đơn/payment mới và không giữ thêm tồn kho. Thứ tự thuộc tính của object JSON không làm thay đổi payload.
- Hỗ trợ `X-Idempotency-Key` để tương thích. Checkout cũng chấp nhận `idempotencyKey` trong body. Nếu gửi nhiều vị trí thì các key phải trùng nhau; khác nhau trả `400`.
- `POST /orders` replay nguyên kết quả tạo đơn đầu tiên. Dùng `GET /orders/:id/status` để lấy trạng thái mới nhất.
- Checkout replay payment hiện tại, giữ nguyên giao dịch/QR, không khởi tạo lần nữa. Sau thanh toán thành công trả trạng thái `SUCCESS`. Key cũ vẫn không tạo giao dịch mới sau khi retry bằng key khác.
- Đơn đã hết hạn/hủy tiếp tục bị từ chối checkout (`409`), kể cả khi gửi key cũ. Webhook thành công lặp đúng `transactionRef` không cập nhật lại payment, thời điểm thanh toán hay tồn kho.

`IdempotencyRecord` lưu hash SHA-256 của payload và kết quả thành công trong cùng transaction với thay đổi đơn/payment/tồn kho. PostgreSQL advisory lock theo `(endpoint, key)` tuần tự hóa các request trùng key trên nhiều tiến trình. Lỗi rollback cả thay đổi dữ liệu và bản ghi key, nên có thể retry. Record không tự hết hạn; không xóa key thành công nếu vẫn cần bảo đảm chống lặp. Key được tra theo endpoint, không dựa vào `userId` do client cung cấp; cơ chế này không thay thế xác thực/phân quyền.

Checkout web lưu key cùng payload trong `sessionStorage`, dùng lại sau timeout hoặc tải lại trang và giữ bản trong bộ nhớ nếu storage bị chặn. Khi payload đổi thì tạo key mới; khi hoàn tất thì xóa phiên. Lỗi tạo QR giữ phiên để retry, không chuyển sang màn hình thành công.

Áp dụng database migration trước khi chạy API mới:

```sh
cd apps/api
npm run prisma:generate
node --env-file=../../.env node_modules/prisma/build/index.js migrate deploy
```

Lệnh trên nạp `.env` ở thư mục gốc khi phát triển cục bộ. Trên môi trường đã cấp `DATABASE_URL`, có thể dùng `npx prisma migrate deploy`.

Chạy các test từ thư mục gốc:

```sh
npm --prefix apps/api test -- --runInBand orders.service.spec.ts payments.service.spec.ts
npm --prefix apps/api run test:e2e -- idempotency
npm --prefix apps/web test
```

Integration test tự triển khai migration trong schema PostgreSQL riêng và dọn schema sau khi chạy. `INT-IDEM-01/02` kiểm tra hai lần tạo đơn cùng key chỉ có một đơn và trừ kho một lần; `INT-PAY-03` kiểm tra cả checkout và webhook lặp. Các test dùng luồng SePay Sandbox của ứng dụng, không phát sinh chuyển tiền ngân hàng thật.
