# Staff Frontend — hợp đồng Backend hiện có

Đã đối chiếu `staff.controller.ts`, `staff.service.ts`, `orders.service.ts`,
`order-transition.ts`, Prisma schema và JWT/role guards trong `apps/api`.
Đây là xác minh source code; chưa gọi Backend thật hoặc xác minh database triển khai.

## Phạm vi hiện tại

Dashboard `/staff` dùng `useStaffOrders` để gọi API thật qua `staffApiClient`.
Luồng mặc định không import `useStaffDemoOrders` hoặc `staffDemoOrders.ts`.
Hai file demo được giữ riêng cho kiểm thử, không làm fallback khi API rỗng/lỗi.
Nút cập nhật được nối với PATCH thật nhưng mặc định disabled bằng feature flag OFF.
Nút Hủy chỉ xuất hiện ở PAID, luôn disabled với tooltip "Chức năng đang phát triển".

- Danh sách gọi GET `/staff/orders` với `page`, `limit: 10` và status khi chọn bộ lọc.
  Đổi bộ lọc trở về trang 1. Nút trước/sau dùng pagination Backend trả về.
- Tìm kiếm không dấu theo mã/tên/bàn chỉ trên dữ liệu trang hiện tại; không gửi search.
- Dashboard không hiển thị banner chỉ xem hoặc bốn thẻ thống kê.
  Tổng kết quả theo bộ lọc vẫn lấy từ pagination.total.
- Nhãn OrderStatus tại bộ lọc, danh sách và chi tiết dùng tên enum tiếng Anh;
  không đổi giá trị API, nhãn thanh toán hoặc các nội dung tiếng Việt khác.
- Khi chọn đơn, GET `/staff/orders/:id` tải chi tiết riêng; không dùng dữ liệu danh sách
  để giả lập kết quả chi tiết. Có loading, lỗi, thử lại và xử lý 404 riêng.
- Làm mới tải lại danh sách và chi tiết đơn đang chọn nếu đơn vẫn nằm trong kết quả.
  Chưa có polling hoặc realtime.

## Khởi tạo và bảo vệ request

`createStaffApiClient({ baseUrl, getAccessToken })` không gọi mạng khi khởi tạo.
Phải truyền URL Backend rõ ràng; không tự đọc biến môi trường hoặc dùng URL fallback.
Hook truyền `NEXT_PUBLIC_API_URL` vào client; thiếu/sai URL sẽ báo CONFIGURATION.
Hook lấy JWT từ khóa localStorage `token` của cơ chế đăng nhập hiện có, không tạo auth mới.
Backend local không có global prefix `/api`: ví dụ base URL `http://localhost:3001`.
Chỉ thêm prefix nếu proxy triển khai thực sự cung cấp prefix đó.

Mỗi request lấy token hiện tại và gửi `Authorization: Bearer <token>`, `cache: no-store`.
Backend yêu cầu JWT hợp lệ và role `BARISTA` hoặc `ADMIN`; UI role gate không thay thế guard.
Có AbortSignal và timeout mặc định 10 giây, bao gồm đọc JSON; không retry tự động.
Client không log token hoặc nội dung lỗi Backend.

`allowStatusUpdates` vẫn mặc định `false`: cập nhật trả `WRITES_DISABLED` trước khi gửi request.
Hook truyền `STAFF_STATUS_UPDATES_ENABLED` từ `src/lib/staffFeatures.ts` vào tùy chọn này.
Chỉ giá trị chính xác `NEXT_PUBLIC_STAFF_STATUS_UPDATES_ENABLED=true` cho phép cập nhật;
thiếu biến hoặc giá trị khác đều OFF. Không đổi `.env` trong triển khai Frontend này.
Biến NEXT_PUBLIC được nhúng lúc build: cần build/deploy lại khi đổi flag.

Không bật flag trên Backend hiện tại. Thành viên Backend cần hoàn tất:

1. Policy thủ công chỉ cho PAID → PREPARING, PREPARING → READY, READY → COMPLETED.
   Áp dụng đồng nhất PATCH `/staff/orders/:id/status` và `/orders/:id/status`;
   không cho thủ công đánh dấu PAID hoặc dùng nhánh thanh toán/thử lại/hủy.
2. PAID → PREPARING kiểm tra Payment SUCCESS, số tiền khớp tổng Order và reservation
   hợp lệ trong transaction đang giữ khóa Order. Xác định rõ xử lý đơn cũ reservation NULL.
3. Giữ transaction/SELECT FOR UPDATE hiện có và bổ sung test cho hai endpoint,
   Payment thiếu/PENDING/FAILED/sai tiền, reservation không hợp lệ và cập nhật đồng thời.

Đối chiếu source: `StaffService.updateOrderStatus` chuyển thẳng sang
`OrdersService.updateStatus`; `OrdersController.updateStatus` cũng gọi service này.
`changeOrderStatus` chưa đọc Payment và `assertTransition` vẫn cho PENDING → PAID.
Không sửa Backend, kho, schema, migrations hoặc SePay trong thay đổi Frontend này.

## Endpoint và query

| Phương thức client | Endpoint Backend | Đầu vào |
| --- | --- | --- |
| `listOrders` | GET `/staff/orders` | `status?`, `page?`, `limit?` |
| `getOrder` | GET `/staff/orders/:id` | ID được encode thành một đoạn đường dẫn |
| `updateOrderStatus` | PATCH `/staff/orders/:id/status` | `{ "status": "PREPARING" }`, hoặc READY/COMPLETED |

Backend còn có GET `/staff` làm alias danh sách. Không hỗ trợ `search`;
`StaffOrdersQuery` không có trường này và client không gửi nó.

- `status`: PENDING, PAYMENT_FAILED, PAID, PREPARING, READY, COMPLETED, CANCELLED.
  Không gửi ALL; bỏ status để lấy tất cả.
- `page`: số nguyên dương, tối đa `2147483647`, mặc định Backend là `1`.
- `limit`: số nguyên dương, tối đa `100`, mặc định Backend là `20`.
- Offset `(page - 1) * limit` không được vượt `2147483647`.
  Client kiểm tra cả giá trị mặc định khi chỉ truyền một tham số.
- Backend sắp xếp `createdAt ASC`, rồi `id ASC`; count và page dùng snapshot RepeatableRead.

## Response và types

Danh sách bắt buộc đúng envelope:

```json
{
  "data": [],
  "pagination": { "page": 1, "limit": 20, "total": 0, "totalPages": 0 }
}
```

`StaffOrdersPage` giữ đủ `pagination`, không đọc `meta` hoặc nhận mảng trần.
`totalPages = ceil(total / limit)`; trang vượt số trang vẫn hợp lệ,
trả `data: []` và giữ tổng đúng.

GET chi tiết trả `StaffOrderDetails` trực tiếp, gồm Order scalar cùng `items` và `payment`.
PATCH trả `StaffOrderScalar` trực tiếp, không có items/payment. Client dùng parser riêng cho PATCH;
không giả lập relations hoặc coi kết quả PATCH là chi tiết đầy đủ. Không nhận envelope `{ data: order }`.

- `StaffOrderScalar`: ID, userId nullable, tên/điện thoại khách, bàn/ghi chú nullable,
  subtotalAmount, discountAmount, totalAmount, status, reservationStatus/reservationExpiresAt nullable,
  promotionId/promotionCode nullable và createdAt/updatedAt.
- `StaffOrderDetails.items`: snapshot id, orderId, productId, productName, unitPrice,
  quantity, size, toppings, itemTotal. Size là string trong schema; luồng tạo đơn hiện kiểm tra S/M/L.
  Topping là `string | null`, ví dụ `Trân châu đen x2, Thạch đào`; không phải mảng object.
- `payment`: null hoặc chỉ id, amount, method, status, paidAt.
  Không yêu cầu hoặc bổ sung `payment.orderId`.
- Payment method: `SEPAY_QR | CASH`; Payment status: `PENDING | SUCCESS | FAILED`.
  PaymentStatus và OrderStatus là hai khái niệm riêng.
- Tiền là JSON number từ Prisma Int; ngày giờ là string, nullable khi schema cho phép.
- `StaffOrder` tiếp tục là projection cho UI/demo; API dùng các kiểu chặt hơn phía trên.

Parser kiểm tra runtime; JSON/shape sai trả `INVALID_RESPONSE`, không fallback sang demo.

## Lỗi

Backend dùng `{ statusCode, timestamp, path, message }`; client phân loại theo HTTP status,
không hiển thị nguyên văn lỗi server. Global filter không giữ allowedTransitions/currentStatus.

| Trường hợp | StaffApiError.code | Xử lý |
| --- | --- | --- |
| 400 | BAD_REQUEST | Kiểm tra query/body, báo yêu cầu không hợp lệ |
| 401 / thiếu token | UNAUTHENTICATED | Ẩn dữ liệu, clearAuthSession hiện có; route chuyển về login |
| 403 | FORBIDDEN | Ẩn toàn bộ danh sách/chi tiết, báo không đủ quyền và cho tải lại |
| 404 | NOT_FOUND | Báo không tìm thấy đơn/API, cho tải lại |
| 409 | CONFLICT | Tải lại đơn, không tự gửi lại PATCH |
| HTTP khác | HTTP | Thông báo và cho thử lại chủ động |
| Mạng / timeout | NETWORK / TIMEOUT | Cho tải lại; không mặc định PATCH thất bại ở server |
| Hủy request | ABORTED | Bỏ phản hồi cũ |
| JSON/shape sai | INVALID_RESPONSE | Báo lỗi dữ liệu |
| Query/URL sai ở client | CONFIGURATION | Không gửi request |
| Cập nhật chưa được bật | WRITES_DISABLED | Không gửi request |

## Giới hạn và kiểm thử tích hợp

Backend dùng state machine chung, transaction và khóa dòng. UI chỉ chuẩn bị ba bước
`PAID → PREPARING → READY → COMPLETED`; server quyết định và trả 409 khi chuyển sai.
Backend hiện cho staff dùng cả nhánh thanh toán/hủy/thử lại của state machine chung;
cần nhóm Backend chốt phạm vi quyền trước khi cho phép cập nhật thật.

GET list/detail gọi `expireReservations()`, có thể hủy đơn hết TTL và hoàn stock.
Không coi GET này trên database thật là kiểm tra hoàn toàn không ghi dữ liệu.

Hook hủy request khi đổi query/lựa chọn, tải lại hoặc unmount; response cũ bị bỏ qua
kể cả fake fetch không tuân theo AbortSignal. Dữ liệu được gắn với key truy vấn để ẩn
ngay trong render khi đổi trang/bộ lọc, trước khi effect cleanup chạy.
Dashboard remount theo user ID và role; đăng xuất hoặc mất quyền sẽ unmount và hủy request.
Lỗi 401/403 từ bất kỳ request nào cũng chặn hiển thị dữ liệu cả hai phần.
PATCH có khóa đồng bộ chống double click, loading và thông báo thành công/lỗi.
Sau thành công hoặc lỗi không phải 401/403, hook tải lại danh sách và chi tiết đang chọn
nếu đơn còn trong kết quả; bộ lọc/trang/tìm kiếm được giữ nguyên. Nếu đơn rời bộ lọc,
chọn đơn còn lại theo cơ chế sẵn có. Không ghép scalar PATCH thành chi tiết giả.
401 xóa session; 403 chặn dữ liệu; 404/409 thông báo và đồng bộ lại từ Backend.
Không tự retry PATCH, kể cả khi lỗi mạng/timeout có thể đã ghi thành công ở server.
Unmount/đổi tài khoản hủy request và bỏ kết quả cũ; abort không bảo đảm server rollback.
Tìm kiếm toàn bộ dữ liệu và thống kê theo ca/toàn hệ thống chưa có API Staff tương ứng;
lọc hoặc đếm trên một trang không đại diện toàn bộ đơn.

Unit test kiểm tra hook và API client bằng JSON mẫu Backend/fake fetch: loading, empty,
lỗi, 401/403, 404 chi tiết, phân trang, status, tìm kiếm local, hủy và response đến muộn.
Không chứng minh API thật hoạt động. Chưa kiểm chứng GET được cấp quyền trên trình duyệt
nếu chưa được cung cấp JWT BARISTA/ADMIN hợp lệ và dữ liệu đơn; không tự tạo user/role/order.
