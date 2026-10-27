# Đặc tả Yêu cầu Phần mềm (SRS) – BrewLite

Tài liệu Đặc tả Yêu cầu Phần mềm (Software Requirements Specification - SRS) rút gọn cho dự án **BrewLite** thuộc học phần **Công nghệ Phần mềm** (Assignment 2).

---

## 1. Yêu cầu Chức năng (Functional Requirements - FR)

Tất cả các yêu cầu được phân loại mức độ ưu tiên theo phương pháp **MoSCoW** (Must, Should, Could, Won't).

### 1.1 Quản lý Thực đơn & Sản phẩm
- **FR-01 – Xem menu sản phẩm**
  - *Mô tả:* Hệ thống cho phép khách hàng xem danh sách sản phẩm đang được cung cấp.
  - *Mức ưu tiên:* Must.
  - *Tiêu chí chấp nhận:* Hiển thị tên sản phẩm, hình ảnh, giá bán và thông tin cơ bản. Các sản phẩm hết hàng hoặc ngừng kinh doanh không hiển thị như sản phẩm có thể đặt.
- **FR-02 – Xem chi tiết sản phẩm**
  - *Mô tả:* Khách hàng có thể xem thông tin chi tiết của một sản phẩm khi chọn vào sản phẩm.
  - *Mức ưu tiên:* Must.
  - *Tiêu chí chấp nhận:* Hiển thị đầy đủ tên, ảnh, mô tả, giá và các tùy chọn (size, topping).
- **FR-03 – Chọn tùy chọn sản phẩm**
  - *Mô tả:* Khách hàng có thể chọn kích cỡ (Size S/M/L) và topping (trân châu, thạch...) nếu món hỗ trợ.
  - *Mức ưu tiên:* Must.
  - *Tiêu chí chấp nhận:* Ghi nhận tùy chọn, cộng dồn phụ phí vào đơn giá và kiểm tra tính hợp lệ trước khi thêm vào giỏ.

### 1.2 Quản lý Giỏ hàng
- **FR-04 – Thêm sản phẩm vào giỏ hàng**
  - *Mô tả:* Khách hàng thêm sản phẩm cùng tùy chọn đã chọn vào giỏ hàng.
  - *Mức ưu tiên:* Must.
  - *Tiêu chí chấp nhận:* Sản phẩm được thêm đúng số lượng, size, topping và đơn giá tạm tính.
- **FR-05 – Cập nhật giỏ hàng**
  - *Mô tả:* Khách hàng thay đổi số lượng hoặc tùy chọn sản phẩm trong giỏ hàng.
  - *Mức ưu tiên:* Must.
  - *Tiêu chí chấp nhận:* Hệ thống cập nhật số lượng (số nguyên dương), tính lại thành tiền từng món và tổng tiền giỏ hàng tức thì.
- **FR-06 – Xóa sản phẩm khỏi giỏ hàng**
  - *Mô tả:* Khách hàng xóa món không muốn mua khỏi giỏ.
  - *Mức ưu tiên:* Must.
  - *Tiêu chí chấp nhận:* Sản phẩm bị loại bỏ và tổng tiền giỏ hàng giảm tương ứng.
- **FR-07 – Kiểm tra giỏ hàng trước khi đặt đơn**
  - *Mô tả:* Hệ thống kiểm tra tính khả dụng của các sản phẩm trong giỏ trước khi tạo đơn.
  - *Mức ưu tiên:* Must.
  - *Tiêu chí chấp nhận:* Chỉ cho phép tiếp tục khi giỏ có ít nhất 01 món hợp lệ. Cảnh báo nếu sản phẩm hết hàng hoặc thay đổi giá.

### 1.3 Tạo Đơn hàng & Quản lý Trạng thái
- **FR-08 – Nhập thông tin nhận đơn**
  - *Mô tả:* Khách hàng cung cấp thông tin liên lạc (họ tên, số điện thoại, ghi chú).
  - *Mức ưu tiên:* Must.
  - *Tiêu chí chấp nhận:* Kiểm tra các trường bắt buộc; báo lỗi nếu dữ liệu không hợp lệ.
- **FR-09 – Xem lại thông tin đơn hàng**
  - *Mô tả:* Khách hàng xem lại toàn bộ thông tin đơn, chi tiết món và tổng tiền trước khi chốt đặt.
  - *Mức ưu tiên:* Must.
  - *Tiêu chí chấp nhận:* Hiển thị chính xác tổng tiền được xác thực từ backend.
- **FR-10 – Tạo đơn hàng**
  - *Mô tả:* Hệ thống tạo bản ghi đơn hàng từ giỏ hàng trong database PostgreSQL.
  - *Mức ưu tiên:* Must.
  - *Tiêu chí chấp nhận:* Đơn hàng có mã định danh duy nhất (UUID), snapshot giá và tùy chọn tại thời điểm đặt, thực hiện trong database transaction; ngăn chặn tạo trùng lặp ngoài ý muốn.
- **FR-11 – Theo dõi trạng thái đơn hàng**
  - *Mô tả:* Khách hàng theo dõi tiến độ xử lý đơn hàng của mình.
  - *Mức ưu tiên:* Must.
  - *Tiêu chí chấp nhận:* Hiển thị mã đơn, thời gian đặt và trạng thái hiện tại đồng bộ với backend.
- **FR-12 – Cập nhật trạng thái đơn hàng**
  - *Mô tả:* Nhân viên quầy cập nhật trạng thái đơn qua quy trình: `PENDING` -> `CONFIRMED` -> `PREPARING` -> `READY` -> `COMPLETED` (hoặc `CANCELLED`).
  - *Mức ưu tiên:* Must.
  - *Tiêu chí chấp nhận:* Chỉ nhân viên có quyền mới được cập nhật; từ chối các bước nhảy trạng thái trái quy tắc State Machine.
- **FR-13 – Xem lịch sử đơn hàng**
  - *Mô tả:* Khách hàng xem lại danh sách các đơn hàng đã đặt trong quá khứ của tài khoản mình.
  - *Mức ưu tiên:* Must.
  - *Tiêu chí chấp nhận:* Chỉ hiển thị đơn hàng thuộc tài khoản đang đăng nhập; không cho phép xem đơn của người khác.

### 1.4 Xác thực Người dùng
- **FR-14 – Đăng ký tài khoản**
  - *Mô tả:* Khách hàng tạo tài khoản mới bằng họ tên, email và mật khẩu.
  - *Mức ưu tiên:* Must.
  - *Tiêu chí chấp nhận:* Email duy nhất, mật khẩu tối thiểu 8 ký tự, mật khẩu được băm (hash bcrypt/Argon2) trước khi lưu.
- **FR-15 – Đăng nhập tài khoản**
  - *Mô tả:* Người dùng đăng nhập bằng email và mật khẩu đã đăng ký.
  - *Mức ưu tiên:* Must.
  - *Tiêu chí chấp nhận:* Trả về JSON Web Token (JWT) hợp lệ khi đúng thông tin; báo lỗi HTTP 401 khi sai.
- **FR-16 – Đăng xuất tài khoản**
  - *Mô tả:* Người dùng kết thúc phiên làm việc hiện tại.
  - *Mức ưu tiên:* Must.
  - *Tiêu chí chấp nhận:* Xóa token xác thực ở frontend; chuyển về trạng thái khách vãng lai.
- **FR-17 – Xác thực truy cập bằng JWT**
  - *Mô tả:* Backend NestJS kiểm tra JWT trên Header Authorization cho các API được bảo vệ.
  - *Mức ưu tiên:* Must.
  - *Tiêu chí chấp nhận:* Từ chối với HTTP 401 nếu thiếu hoặc token hết hạn; từ chối HTTP 403 nếu không đủ quyền.

### 1.5 Thanh toán Mô phỏng
- **FR-18 – Lựa chọn phương thức thanh toán**
  - *Mô tả:* Khách hàng chọn hình thức thanh toán trực tuyến mô phỏng (Ví điện tử hoặc Thẻ).
  - *Mức ưu tiên:* Must.
  - *Tiêu chí chấp nhận:* Hiển thị các phương thức hỗ trợ; ghi nhận phương thức vào thông tin thanh toán của đơn.
- **FR-19 – Xử lý thanh toán mô phỏng**
  - *Mô tả:* Hệ thống kết nối với cổng thanh toán sandbox (SePay) để xử lý giao dịch.
  - *Mức ưu tiên:* Must.
  - *Tiêu chí chấp nhận:* Số tiền khớp chính xác với đơn hàng; hỗ trợ mô phỏng cả trường hợp thành công lẫn thất bại.
- **FR-20 – Xác nhận kết quả thanh toán**
  - *Mô tả:* Tiếp nhận kết quả thanh toán (qua Webhook/IPN) và cập nhật trạng thái thanh toán của đơn hàng.
  - *Mức ưu tiên:* Must.
  - *Tiêu chí chấp nhận:* Khi thành công chuyển đơn sang `PAID` và lưu mã giao dịch; khi thất bại không đánh dấu đơn đã thanh toán.
- **FR-21 – Ngăn chặn thanh toán trùng lặp**
  - *Mô tả:* Hệ thống kiểm soát yêu cầu gửi lại nhằm tránh trừ tiền hai lần cho cùng một đơn hàng.
  - *Mức ưu tiên:* Must.
  - *Tiêu chí chấp nhận:* Sử dụng `Idempotency-Key`; nếu nhận yêu cầu trùng, trả về kết quả cũ mà không tạo giao dịch mới.

---

## 2. Yêu cầu Phi chức năng (Non-Functional Requirements - NFR)

### 2.1 Bảo mật (Security)
- **NFR-01 – Bảo vệ mật khẩu:** Mật khẩu được băm bằng bcrypt/Argon2 kèm salt; API không bao giờ trả về trường password/hash. *(Must)*
- **NFR-02 – Bảo mật truyền tải:** Môi trường production bắt buộc sử dụng HTTPS; thông tin nhạy cảm không truyền qua HTTP thuần. *(Must)*
- **NFR-03 – Kiểm soát truy cập:** Áp dụng Role-based Access Control (RBAC); khách hàng không thể can thiệp đơn của khách khác. *(Must)*
- **NFR-04 – Xác thực dữ liệu đầu vào:** Backend validate kiểu dữ liệu, định dạng (class-validator/Zod); chống SQL Injection thông qua Prisma ORM. *(Must)*
- **NFR-05 – Quản lý bí mật:** JWT Secret, Database Credentials, API Keys được quản lý qua biến môi trường (.env); không commit lên git. *(Must)*
- **NFR-06 – Ghi nhận sự kiện bảo mật:** Log lại các lần login thất bại, lỗi thanh toán; tuyệt đối không ghi password hoặc secret vào log. *(Should)*

### 2.2 Hiệu năng & Khả năng chịu tải (Performance & Scalability)
- **NFR-07 – Thời gian phản hồi API:** 95% request GET dưới 2 giây; request POST/PUT dưới 3 giây trong điều kiện mạng bình thường. *(Must)*
- **NFR-08 – Chịu tải đồng thời:** Hệ thống chịu tải tối thiểu 100 người dùng đồng thời, tỷ lệ lỗi 5xx dưới 1%, xử lý ít nhất 100 req/s. *(Should)*

### 2.3 Tính khả dụng (Usability)
- **NFR-09 – Giao diện Mobile-first & PWA:** Tối ưu hiển thị cho màn hình di động từ 375px trở lên; hỗ trợ Add to Home Screen. *(Must)*
- **NFR-10 – Phản hồi giao diện:** Hiển thị Skeleton/Spinner khi tải dữ liệu; hiển thị thông báo lỗi thân thiện kèm nút thử lại khi mất mạng. *(Must)*

### 2.4 Khả năng triển khai & Vận hành (Deployment & DevOps)
- **NFR-11 – Đóng gói Container:** Cung cấp `docker-compose.yml` chạy hoàn chỉnh web, api và database PostgreSQL local với một lệnh duy nhất. *(Must)*
- **NFR-12 – CI/CD & Health Check:** Tích hợp GitHub Actions chặn merge khi lint/test/build lỗi; cung cấp endpoint `GET /health` trả về 200 OK. *(Should)*

---

## 3. Đặc tả Use-Case Trọng tâm (UC-01: Đặt và thanh toán đơn hàng)

| Thuộc tính | Chi tiết |
|---|---|
| **Mã Use-case** | UC-01 |
| **Tên Use-case** | Đặt và thanh toán đơn hàng |
| **Actor chính** | Khách hàng (Customer) |
| **Actor phụ / Hệ thống** | NestJS Backend API, PostgreSQL Database, SePay Sandbox |
| **Trigger** | Khách hàng nhấn nút "Thanh toán" hoặc "Xác nhận đặt hàng" từ màn hình giỏ hàng |
| **Mã yêu cầu** | FR-04, FR-05, FR-07 (Giỏ hàng); FR-08, FR-09, FR-10 (Tạo đơn); FR-17 (JWT); FR-18..21 (Thanh toán) |
| **Tiền điều kiện** | 1. Đã đăng nhập (có JWT hợp lệ).<br/>2. Giỏ hàng có ít nhất 01 sản phẩm.<br/>3. Dịch vụ thanh toán đang hoạt động. |
| **Hậu điều kiện** | - Thành công: Đơn hàng ở trạng thái PAID, trừ tồn kho, giỏ hàng được làm sạch, chuyển sang màn hình theo dõi.<br/>- Thất bại: Đơn hàng CANCELLED, hoàn tồn kho, giỏ hàng giữ nguyên, báo lỗi. |

### Luồng sự kiện chính (Main Flow):
1. Khách hàng kiểm tra giỏ hàng trên Next.js UI (món, size, topping, tổng tiền).
2. Khách hàng nhấn "Thanh toán".
3. UI hiển thị màn hình xác nhận thông tin và chọn phương thức thanh toán (Ví/Thẻ).
4. Khách hàng chọn phương thức thanh toán và nhấn "Xác nhận đặt hàng".
5. Next.js gửi `POST /orders` kèm Bearer JWT và `Idempotency-Key` tới NestJS API.
6. NestJS xác thực JWT, validate payload, kiểm tra tồn kho trong PostgreSQL.
7. NestJS khởi tạo đơn hàng tạm thời (`PENDING`) và gọi SePay Payment Gateway.
8. SePay xử lý giao dịch thành công và trả về Transaction ID.
9. NestJS cập nhật đơn hàng thành `PAID`, trừ số lượng tồn kho sản phẩm trong một Database Transaction duy nhất.
10. NestJS trả về phản hồi HTTP 201 Created.
11. Next.js xóa giỏ hàng local và chuyển hướng khách hàng sang màn hình Theo dõi đơn hàng.

### Luồng thay thế & ngoại lệ:
- **AF-01 (Mã giảm giá):** Tại bước 3, áp dụng voucher hợp lệ -> tính lại tổng tiền.
- **EF-01 (Token hết hạn - 401):** Yêu cầu khách hàng đăng nhập lại.
- **EF-02 (Hết hàng - 400):** Tồn kho không đủ tại bước 6 -> hủy tạo đơn, yêu cầu cập nhật giỏ.
- **EF-03 (Thanh toán thất bại):** Cổng thanh toán trả về lỗi -> cập nhật đơn CANCELLED, giữ giỏ hàng, cho phép thử lại.
- **EF-04 (Trùng Idempotency-Key):** Nhận lại key đã xử lý -> trả về kết quả cũ mà không trừ tồn kho lần 2.

---

## 4. Checklist Rà soát Chất lượng SRS (Verification Checklist)

| Tiêu chuẩn | Nội dung kiểm tra | Kết quả |
|---|---|:---:|
| **Tính đầy đủ (Completeness)** | Đủ 21 FR, 12 NFR, UC-01, MoSCoW, Acceptance Criteria | **Đạt** |
| **Tính nhất quán (Consistency)** | Mã số liên tục không trùng, thuật ngữ công nghệ đồng bộ | **Đạt** |
| **Tính rõ ràng (Unambiguity)** | Tiêu chí chấp nhận định lượng, mã HTTP rõ ràng | **Đạt** |
| **Khả kiểm (Verifiability)** | Đo lường được qua Unit Test, E2E Test | **Đạt** |
| **Khả truy vết (Traceability)** | FR ánh xạ trực tiếp sang UC-01 và ma trận truy vết | **Đạt** |
| **Tính khả thi (Feasibility)** | Phạm vi chuẩn MVP, phù hợp thời hạn môn học | **Đạt** |
