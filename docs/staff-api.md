# API nhân viên BrewLite

API phục vụ nhân viên quầy theo US-10 / FR-12, dùng NestJS, Prisma và dữ liệu đơn hàng hiện có. Base URL local: `http://localhost:3001`. Không cần migration hoặc cài thêm dependency.

## Đăng nhập và phân quyền

Tất cả endpoint `/staff` yêu cầu header `Authorization: Bearer <accessToken>`. Chỉ tài khoản có role `BARISTA` hoặc `ADMIN` được truy cập. Thiếu token, token sai hoặc hết hạn trả **401**; tài khoản `CUSTOMER` trả **403**.

Đăng nhập qua `POST /auth/login` hiện có. API đăng ký công khai luôn tạo `CUSTOMER`, kể cả khi gửi thêm trường `role`.

Để chuẩn bị tài khoản nhân viên local:

1. Tạo tài khoản qua `POST /auth/register` với `email`, `password`, `fullName`.
2. Người quản trị cập nhật role trong PostgreSQL hoặc Prisma Studio. Ví dụ SQL cho tài khoản đã đăng ký:

   ```sql
   UPDATE "User" SET "role" = 'BARISTA', "updatedAt" = NOW()
   WHERE "email" = 'barista@example.com';
   ```

3. Đăng nhập lại để nhận token chứa role mới.

Ví dụ PowerShell:

```powershell
$login = Invoke-RestMethod -Method Post -Uri 'http://localhost:3001/auth/login' `
  -ContentType 'application/json' `
  -Body '{"email":"barista@example.com","password":"your-password"}'
$headers = @{ Authorization = "Bearer $($login.accessToken)" }
```

## Endpoint

| Method | URL | Chức năng |
|---|---|---|
| `GET` | `/staff` | Danh sách đơn, tương đương `/staff/orders` |
| `GET` | `/staff/orders` | Danh sách đơn, lọc trạng thái và phân trang |
| `GET` | `/staff/orders/:id` | Chi tiết thông tin nhận đơn, món và thanh toán |
| `PATCH` | `/staff/orders/:id/status` | Cập nhật trạng thái theo state machine |

Endpoint cũ `PATCH /orders/:id/status` cũng yêu cầu JWT với role `BARISTA` hoặc `ADMIN` và dùng cùng logic cập nhật.

### Danh sách đơn

Ví dụ: `GET /staff/orders?status=PAID&page=1&limit=20`.

| Query | Mặc định | Quy tắc |
|---|---|---|
| `status` | Tất cả trạng thái | Một giá trị trong `PENDING`, `PAYMENT_FAILED`, `PAID`, `PREPARING`, `READY`, `COMPLETED`, `CANCELLED` |
| `page` | `1` | Số nguyên dương; vị trí bắt đầu trang không vượt `2147483647` |
| `limit` | `20` | Số nguyên dương, tối đa `100` |

Các giá trị rỗng, không đúng định dạng hoặc query lặp như `status=PAID&status=READY` trả **400**. Đơn được sắp xếp theo `createdAt` tăng dần để xử lý đơn cũ trước; `id` là tiêu chí phụ khi trùng thời gian. Để xem hàng đợi, lần lượt lọc `PAID`, `PREPARING` hoặc `READY`.

Phản hồi **200**:

```json
{
  "data": [
    {
      "id": "order-id",
      "customerName": "Nguyễn Văn A",
      "customerPhone": "0900000000",
      "tableNumber": 3,
      "notes": "Ít đá",
      "totalAmount": 30000,
      "status": "PAID",
      "items": [],
      "payment": null
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 1, "totalPages": 1 }
}
```

Ví dụ trên lược bớt các trường ID khách hàng, tồn kho giữ chỗ và thời gian của đơn. `items` chứa snapshot `productName`, `unitPrice`, `quantity`, `size`, `toppings`, `itemTotal` cùng các ID liên quan. `payment` là `null` khi chưa có giao dịch; nếu có, chỉ gồm `id`, `amount`, `method`, `status`, `paidAt`. API không đính kèm tài khoản/mật khẩu, idempotency key hay thông tin gateway.

Không có kết quả trả `data: []`, `total: 0`, `totalPages: 0`. Trang vượt số trang trả `data: []` và vẫn giữ tổng số kết quả đúng. Tổng và dữ liệu trang được đọc trong cùng một snapshot PostgreSQL.

```powershell
Invoke-RestMethod -Uri 'http://localhost:3001/staff/orders?status=PAID&page=1&limit=20' -Headers $headers
Invoke-RestMethod -Uri 'http://localhost:3001/staff/orders/order-id' -Headers $headers
```

### Cập nhật trạng thái

```http
PATCH /staff/orders/order-id/status
Authorization: Bearer <accessToken>
Content-Type: application/json

{ "status": "PREPARING" }
```

Luồng pha chế: `PAID -> PREPARING -> READY -> COMPLETED`. Hủy đơn bằng `CANCELLED` khi đơn còn `PENDING`, `PAYMENT_FAILED` hoặc `PAID`. API dùng toàn bộ [state machine hiện có](../apps/api/src/orders/order-state-machine.ts), bao gồm các nhánh thanh toán/thử lại.

```powershell
Invoke-RestMethod -Method Patch -Uri 'http://localhost:3001/staff/orders/order-id/status' `
  -Headers $headers -ContentType 'application/json' -Body '{"status":"PREPARING"}'
```

- **200:** trả đơn đã cập nhật.
- **400:** thiếu trạng thái hoặc giá trị không hợp lệ.
- **401/403:** không xác thực được hoặc thiếu quyền.
- **404:** không tìm thấy đơn (áp dụng cả API chi tiết).
- **409:** chuyển sai bước, tự chuyển hoặc thay đổi đơn đã kết thúc; đơn giữ nguyên.

Việc cập nhật dùng transaction và khóa dòng chung với checkout/IPN. Hủy đơn hoàn lại tồn kho theo cơ chế hiện có và không hoàn trùng. API danh sách/chi tiết xử lý reservation quá hạn trước khi đọc để phản ánh trạng thái hủy do hết TTL.

## Kiểm thử

```powershell
npm.cmd --prefix apps/api run lint
npm.cmd --prefix apps/api run test:e2e -- staff
```

`apps/api/test/staff.e2e-spec.ts` chạy HTTP thật với PostgreSQL trong schema riêng, tự dọn schema sau khi kết thúc. Các nhóm `INT-STAFF-01..15` kiểm tra JWT/RBAC, ngăn tự gán quyền lúc đăng ký, cả hai role nhân viên, lọc/phân trang, snapshot món, ẩn dữ liệu xác thực, 400/404/409, cập nhật đồng thời và hoàn tồn kho/TTL.
