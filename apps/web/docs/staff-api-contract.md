# Staff Frontend — hợp đồng đề xuất, chưa kết nối Backend

`/staff` luôn dùng `useStaffDemoOrders` và dữ liệu riêng trong `staffDemoOrders.ts`.
Tìm kiếm, bộ lọc và thống kê chạy trong bộ dữ liệu demo trên trình duyệt.
Không tải `/orders/history`, không gọi API Staff, không gửi PATCH; nút thao tác vẫn bị khóa.
Phân quyền BARISTA / ADMIN hiện chỉ bảo vệ giao diện, không thay thế JWT / guards Backend.

## Client chuẩn bị cho tích hợp

`src/services/staffApiClient.ts` xuất `createStaffApiClient`.
Khởi tạo client không gọi mạng. Cần truyền rõ `baseUrl`, `getAccessToken` và sau này
gọi từng phương thức khi đã có API an toàn. Không tự đọc biến môi trường, không có URL
fallback, không tự thay đổi token hoặc chuyển trang. Dashboard hiện không import client.
`allowStatusUpdates` mặc định `false`: gọi phương thức cập nhật cũng không gửi PATCH.
Chỉ bật sau khi nhóm đã xác nhận bảo mật, hợp đồng và cho phép tích hợp.

| Phương thức | Endpoint đề xuất | Đầu vào |
| --- | --- | --- |
| `listOrders` | GET `/staff/orders` | `status?`, `search?`, `page?`, `limit?` |
| `getOrder` | GET `/staff/orders/:id` | ID được encode thành một đoạn đường dẫn |
| `updateOrderStatus` | PATCH `/staff/orders/:id/status` | `{ "status": "PREPARING" \| "READY" \| "COMPLETED" }` |

Các request dùng Bearer JWT lấy mới cho mỗi lần gọi, `cache: no-store`, có AbortSignal
và timeout mặc định 10 giây (kể cả đọc JSON). Không retry tự động, đặc biệt với PATCH/409.
Client không log token hay nội dung lỗi Backend. UI tích hợp sau này phải hủy request
khi đổi tài khoản/đăng xuất và bỏ phản hồi cũ; client không tự quản lý lifecycle React.

## Dữ liệu cần Backend xác nhận

Types là read model đề xuất trong `src/types/staff.ts`, không khẳng định API đã tồn tại.
Danh sách nhận `StaffOrder[]` hoặc `{ data: StaffOrder[], meta?: { page, limit, total } }`;
chi tiết/cập nhật nhận `StaffOrder` hoặc `{ data: StaffOrder }`. Nếu có `success: false`
dù HTTP 200, client coi là dữ liệu lỗi. Các field hiển thị được kiểm tra runtime; dữ liệu
sai cấu trúc bị từ chối, không fallback sang demo.

- Order: ID string, tên khách, số điện thoại tùy chọn, bàn `number | null`, ghi chú
  `string | null`, trạng thái AS2, tổng tiền number, createdAt/updatedAt dạng ngày giờ.
- Items: ID món/sản phẩm, tên, đơn giá number, số lượng nguyên dương, size string,
  topping hiện là `string | null`, thành tiền number. Cần xác nhận size enum và topping
  có cần đổi sang snapshot chi tiết số lượng/phụ phí không.
- Payment: object hoặc null; phương thức `SEPAY_QR | CASH`, trạng thái
  `PENDING | SUCCESS | FAILED`, amount number, paidAt ngày giờ hoặc null.
- Hiện client yêu cầu tiền JSON number, không tự chuyển Prisma Decimal string;
  nếu Backend trả chuỗi, cần thống nhất adapter rõ ràng. Tổng tiền Backend là nguồn chuẩn.

## Lỗi và trách nhiệm trước khi tích hợp

| Trường hợp | `StaffApiError.code` | UI cần thực hiện khi tích hợp |
| --- | --- | --- |
| 401 / thiếu token | UNAUTHENTICATED | Xóa dữ liệu riêng, xử lý đăng nhập lại qua auth hiện có |
| 403 | FORBIDDEN | Xóa dữ liệu, thông báo không đủ quyền |
| 404 | NOT_FOUND | Báo đơn/API không tồn tại, cho tải lại danh sách |
| 409 | CONFLICT | Tải lại chi tiết, không tự gửi lại PATCH |
| HTTP khác | HTTP | Thông báo lỗi và nút thử lại chủ động |
| Mất mạng / timeout | NETWORK / TIMEOUT | Thông báo, cho thử lại chủ động |
| Request bị hủy | ABORTED | Bỏ qua phản hồi; không hiển thị lỗi cũ |
| JSON hoặc shape sai | INVALID_RESPONSE | Báo lỗi dữ liệu, không dùng mock làm fallback |

Backend cần xác nhận thêm:

1. Endpoint/prefix và response envelope thật; phân trang, thứ tự, tìm kiếm không dấu,
   tìm theo mã/tên/bàn và múi giờ/thống kê toàn hệ thống hay theo ca.
2. JWT guards + roles BARISTA/ADMIN cho cả ba endpoint; CUSTOMER không được đọc/ghi.
3. Luồng PAID → PREPARING → READY → COMPLETED được kiểm soát ở server,
   phân biệt trạng thái đơn với thanh toán, chặn đơn chưa thanh toán/chuyển sai.
4. Cơ chế chống hai nhân viên cập nhật đồng thời (version/updatedAt/If-Match), ý nghĩa
   409 và tính idempotent. Payload hiện chưa có version vì hợp đồng chưa chốt.
5. CORS/URL môi trường triển khai, timeout, chính sách token hết hạn, quyền truy cập
   thông tin khách; polling hay sự kiện realtime và API thống kê nếu cần.

Chưa xác minh bằng Backend thật hoặc thao tác đơn thật trong giai đoạn này.
