# Ma trận truy vết yêu cầu – BrewLite

Ma trận này ánh xạ từng yêu cầu chức năng (FR) trong [SRS](./requirements/srs.md) sang User Story/Use-case, sơ đồ thiết kế và component kiến trúc chịu trách nhiệm. Component ở đây là các khối logic dự kiến của kiến trúc Next.js – NestJS – PostgreSQL – SePay, không phải tên module/mã nguồn đã triển khai.

> **Trạng thái sơ đồ:** `docs/diagrams/` hiện chưa có sơ đồ được lưu. Các mã AD-01, SD-01, CD-01 và SM-01 dưới đây là mã tham chiếu thống nhất để dùng khi tạo và đặt tên sơ đồ; cần thay bằng tên file thực tế nếu tên file khác. SM-01 được đưa vào để truy vết rõ vòng đời trạng thái đơn hàng theo SRS.

## Danh mục sơ đồ

| Mã | Sơ đồ | Phạm vi |
|---|---|---|
| **AD-01** | Activity Diagram – Luồng đặt hàng | Luồng nghiệp vụ từ xem menu đến nhận đơn; gồm các nhánh nghiệp vụ liên quan. |
| **SD-01** | Sequence Diagram – Checkout (UC-01) | Tương tác Customer → Next.js → NestJS → PostgreSQL → SePay trong luồng đặt và thanh toán. |
| **CD-01** | Class Diagram – Domain Model | Các lớp miền `User`, `Product`, `Order`, `OrderItem`, `Payment`, `Promotion`, `LoyaltyTransaction` và quan hệ giữa chúng. |
| **SM-01** | State Machine – Order | Các trạng thái đơn hàng và chuyển trạng thái hợp lệ theo FR-11/FR-12. |

## Danh mục component

| Mã component | Trách nhiệm |
|---|---|
| **WEB-MENU** | Next.js: danh sách sản phẩm và điều hướng menu. |
| **WEB-PRODUCT** | Next.js: chi tiết sản phẩm, lựa chọn size/topping và giá tạm tính. |
| **WEB-CART** | Next.js: giỏ hàng phía khách hàng; quản lý món, số lượng, tùy chọn và tổng tiền. |
| **WEB-CHECKOUT** | Next.js: kiểm tra giỏ, nhập thông tin nhận đơn, xem lại đơn và chọn phương thức thanh toán. |
| **WEB-ORDER** | Next.js: theo dõi đơn và xem lịch sử đơn hàng. |
| **WEB-AUTH** | Next.js: đăng ký, đăng nhập, lưu/xóa thông tin phiên xác thực. |
| **API-PRODUCT** | NestJS: truy vấn sản phẩm, tình trạng còn hàng và giá hiện hành. |
| **API-ORDER** | NestJS: kiểm tra dữ liệu đặt hàng, tạo đơn và truy vấn đơn hàng. |
| **API-ORDER-STATUS** | NestJS: kiểm tra quyền và xử lý chuyển trạng thái đơn hàng. |
| **API-AUTH** | NestJS: đăng ký, đăng nhập và xác thực JWT/ủy quyền. |
| **API-PAYMENT** | NestJS: tạo/yêu cầu thanh toán, nhận IPN và xử lý idempotency. |
| **DB-PRODUCT** | PostgreSQL: dữ liệu sản phẩm và tồn kho. |
| **DB-ORDER** | PostgreSQL: đơn hàng, chi tiết đơn và trạng thái. |
| **DB-USER** | PostgreSQL: tài khoản người dùng. |
| **DB-PAYMENT** | PostgreSQL: thông tin và mã giao dịch thanh toán. |
| **PAY-SEPAY** | SePay Sandbox: xử lý giao dịch mô phỏng và gửi kết quả/IPN. |

## Ánh xạ FR

| Mã yêu cầu | User Story / Use-case | Diagram | Component |
|---|---|---|---|
| **FR-01** Xem menu sản phẩm | US-01 | AD-01, CD-01 (`Product`) | WEB-MENU, API-PRODUCT, DB-PRODUCT |
| **FR-02** Xem chi tiết sản phẩm | US-02 | AD-01, CD-01 (`Product`) | WEB-PRODUCT, API-PRODUCT, DB-PRODUCT |
| **FR-03** Chọn size và topping | US-03 | AD-01, CD-01 (`Product`, `OrderItem`) | WEB-PRODUCT, WEB-CART, API-PRODUCT |
| **FR-04** Thêm sản phẩm vào giỏ | US-04 | AD-01, CD-01 (`OrderItem`) | WEB-CART |
| **FR-05** Cập nhật giỏ hàng | US-05 | AD-01, CD-01 (`OrderItem`) | WEB-CART |
| **FR-06** Xóa sản phẩm khỏi giỏ | US-06 | AD-01, CD-01 (`OrderItem`) | WEB-CART |
| **FR-07** Kiểm tra giỏ trước khi đặt | US-07 (tiền điều kiện), UC-01 | AD-01, SD-01 | WEB-CART, WEB-CHECKOUT, API-PRODUCT, API-ORDER, DB-PRODUCT |
| **FR-08** Nhập thông tin nhận đơn | US-07, UC-01 | AD-01, SD-01 | WEB-CHECKOUT, API-ORDER |
| **FR-09** Xem lại thông tin đơn | US-07, UC-01 | AD-01, SD-01, CD-01 (`Order`, `OrderItem`) | WEB-CHECKOUT, API-ORDER, DB-ORDER |
| **FR-10** Tạo đơn hàng | US-08, UC-01 | AD-01, SD-01, CD-01 (`Order`, `OrderItem`) | WEB-CHECKOUT, API-ORDER, DB-ORDER, DB-PRODUCT |
| **FR-11** Theo dõi trạng thái đơn | US-09 | AD-01, SD-01, SM-01, CD-01 (`Order`) | WEB-ORDER, API-ORDER, DB-ORDER |
| **FR-12** Cập nhật trạng thái đơn | US-10 | AD-01, SM-01, CD-01 (`Order`, `User`) | API-ORDER-STATUS, API-AUTH, DB-ORDER, DB-USER |
| **FR-13** Xem lịch sử đơn hàng | US-14 | CD-01 (`User`, `Order`) | WEB-ORDER, API-ORDER, API-AUTH, DB-ORDER, DB-USER |
| **FR-14** Đăng ký tài khoản | US-13 | CD-01 (`User`) | WEB-AUTH, API-AUTH, DB-USER |
| **FR-15** Đăng nhập tài khoản | US-13 | SD-01 (xác thực khi checkout), CD-01 (`User`) | WEB-AUTH, API-AUTH, DB-USER |
| **FR-16** Đăng xuất tài khoản | US-13 | CD-01 (`User`) | WEB-AUTH |
| **FR-17** Xác thực truy cập bằng JWT | UC-01 (bước xác thực) | SD-01, CD-01 (`User`) | API-AUTH |
| **FR-18** Chọn phương thức thanh toán | US-11, UC-01 | AD-01, SD-01, CD-01 (`Payment`) | WEB-CHECKOUT, API-PAYMENT |
| **FR-19** Xử lý thanh toán mô phỏng | US-12, UC-01 | SD-01, CD-01 (`Payment`, `Order`) | API-PAYMENT, PAY-SEPAY, DB-PAYMENT |
| **FR-20** Xác nhận kết quả thanh toán | US-12, UC-01 | SD-01, CD-01 (`Payment`, `Order`) | PAY-SEPAY, API-PAYMENT, DB-PAYMENT, DB-ORDER |
| **FR-21** Ngăn chặn thanh toán trùng lặp | US-12, UC-01 | SD-01, CD-01 (`Payment`) | API-PAYMENT, DB-PAYMENT |

## Ghi chú truy vết

- US-07 bao gồm cả nhập thông tin và xem lại đơn (FR-08, FR-09); FR-07 là điều kiện để bắt đầu UC-01, không có User Story riêng.
- US-13 gộp đăng ký, đăng nhập và đăng xuất; US-14 ánh xạ tới FR-13. Không tạo mã User Story riêng cho từng FR trong các nhóm này.
- FR-16 theo SRS kết thúc phiên bằng cách xóa thông tin xác thực ở frontend; do đó component được ánh xạ trực tiếp là WEB-AUTH.
- Các component là ranh giới trách nhiệm logic để phục vụ thiết kế Task 3. Khi kiến trúc/module được chốt hoặc triển khai, cập nhật mã component tương ứng để tiếp tục truy vết tới mã nguồn và kiểm thử.
