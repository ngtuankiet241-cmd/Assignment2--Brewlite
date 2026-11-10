# Đặc tả kiểm thử Product và Health

## Phạm vi

Các đường dẫn `backend/` trong yêu cầu được ánh xạ sang `apps/api/` theo cấu trúc repository hiện tại. Test E2E khởi tạo `AppModule` thật và gửi HTTP request bằng Supertest. Test sản phẩm và health thành công sử dụng PostgreSQL thật, không mock `ProductsService` hay truy vấn sản phẩm.

Backend bổ sung `GET /health`: thực hiện `SELECT 1`, trả HTTP 200 khi database phản hồi thành công. Nếu truy vấn lỗi hoặc không phản hồi trong 1.000 ms, endpoint trả HTTP 503. Phản hồi lỗi không chứa thông tin kết nối hay lỗi nội bộ của database.

## Danh sách ca kiểm thử

| Test ID | File test | Nội dung kiểm thử | Tiền điều kiện / Dữ liệu | Bước thực hiện | Kết quả mong muốn |
|---|---|---|---|---|---|
| E2E-PROD-01 | `apps/api/test/products.e2e-spec.ts` | Gọi `GET /products` khi có sản phẩm | Schema test có Latte và Americano còn hàng, một sản phẩm có `stock = 0`; tạo Latte trước Americano | Gửi `GET /products` | HTTP **200**, JSON có `success: true`, `message: "Lấy danh sách sản phẩm thành công"`; `data` chứa đủ các trường `id`, `name`, `description`, `price`, `imageUrl`, `stock` và đúng dữ liệu đã lưu. Chỉ trả sản phẩm có `stock > 0`, theo thứ tự Americano rồi Latte. |
| E2E-PROD-02 | `apps/api/test/products.e2e-spec.ts` | Lấy danh sách khi không có sản phẩm | Bảng `Product` trong schema test rỗng | Gửi `GET /products` | HTTP **200**, JSON có `success: true`, `message: "Lấy danh sách sản phẩm thành công"`, `data: []`. |
| E2E-PROD-05 | `apps/api/test/products.e2e-spec.ts` | Gọi `GET /products/:id` với ID tồn tại | Tạo một sản phẩm trong schema test và lấy ID được Prisma sinh ra | Gửi `GET /products/{id}` với ID vừa tạo | HTTP **200**, JSON có `success: true`, `message: "Lấy chi tiết sản phẩm thành công"`; `data` khớp toàn bộ thông tin sản phẩm trong database. |
| E2E-PROD-06 | `apps/api/test/products.e2e-spec.ts` | Truy vấn sản phẩm không tồn tại | Không có sản phẩm mang ID `missing-product-id` | Gửi `GET /products/missing-product-id` | HTTP **404**, JSON có `statusCode: 404`, `error: "Not Found"`, `message: "Product with ID missing-product-id was not found"`. |
| E2E-HEALTH-01 | `apps/api/test/health.e2e-spec.ts` | Gọi `GET /health` khi ứng dụng hoạt động | NestJS đã khởi tạo; PostgreSQL thật truy cập được | Gửi `GET /health` | HTTP **200**, JSON chính xác `{"status":"ok","database":"up"}`. |
| E2E-HEALTH-02 | `apps/api/test/health.e2e-spec.ts` | Database mất kết nối khi kiểm tra health | Sau khi ứng dụng khởi tạo, mô phỏng `$queryRaw` thất bại bằng Jest spy | Gửi `GET /health` | HTTP **503**, JSON chính xác `{"status":"error","database":"down"}`. Không trả thành công hoặc lộ thông tin lỗi nội bộ. |
| UT-HEALTH-01 | `apps/api/src/health/health.service.spec.ts` | Logic kiểm tra health gặp lỗi hoặc timeout | Hai trường hợp: Prisma từ chối truy vấn với lỗi kết nối; hoặc truy vấn không bao giờ hoàn thành | Gọi `HealthService.check()`; với trường hợp timeout, dùng fake timers và tăng thời gian 1.000 ms | Cả hai trường hợp đều ném `ServiceUnavailableException` có HTTP **503** và nội dung `{"status":"error","database":"down"}`. Lỗi kết nối không bị lộ trong phản hồi. Trường hợp timeout kết thúc dù database không phản hồi. |

`UT-HEALTH-01` được triển khai thành hai test độc lập cho lỗi truy vấn và timeout. Tổng cộng có **6 test E2E và 2 unit test mới**, tương ứng **7 Test ID**. Năm unit test sản phẩm hiện có vẫn được giữ nguyên.

## Chuẩn bị dữ liệu và môi trường

- Cài dependencies trong `apps/api` và sinh Prisma Client: `npm --prefix apps/api ci`, sau đó `npm --prefix apps/api run prisma:generate`.
- PostgreSQL phải đang chạy. Cấu hình `DATABASE_URL` trong `.env` tại thư mục gốc hoặc qua biến môi trường. Có thể dùng `TEST_DATABASE_URL` để chỉ định một database test riêng; biến này được ưu tiên hơn `DATABASE_URL`.
- Tài khoản database phải có quyền tạo và xóa schema trong database được chọn. Không cần khởi động API hoặc web trước khi chạy test.
- Mỗi bộ E2E tạo schema riêng có tên `brewlite_e2e_<UUID>` và áp dụng migration đã lưu trong repository. Các thao tác tạo/xóa sản phẩm chỉ chạy trong schema đó; schema được xóa sau khi bộ test kết thúc. Schema và dữ liệu đã seed của ứng dụng không bị sửa.
- Ca mất kết nối mô phỏng lỗi tại truy vấn Prisma, không dừng PostgreSQL đang dùng chung. Unit test timeout dùng fake timers, không chờ 1 giây thật.

## Lệnh chạy

Chạy từ thư mục gốc repository:

```bash
# Unit test: 5 test sản phẩm hiện có và 2 test health mới
npm --prefix apps/api test -- --runInBand

# 6 test E2E Product và Health
npm --prefix apps/api run test:e2e

# Kiểm tra build backend; không đưa các file test vào bản build
npm --prefix apps/api run build
```

Trên PowerShell, có thể dùng `npm.cmd` thay cho `npm` nếu execution policy chặn `npm.ps1`.
