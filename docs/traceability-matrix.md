# Ma trận truy vết yêu cầu – BrewLite

Ma trận này ánh xạ từng yêu cầu chức năng (FR) trong [SRS](./requirements/srs.md) sang User Story/Use-case, sơ đồ thiết kế và component kiến trúc chịu trách nhiệm. Component ở đây là các khối logic dự kiến của kiến trúc Next.js – NestJS – PostgreSQL – SePay, không phải tên module/mã nguồn đã triển khai.

> **Trạng thái sơ đồ:** Toàn bộ sơ đồ tham chiếu (**AD-01**, **SD-01**, **CD-01**, **DD-01**) đã được hoàn thiện và lưu trữ tại thư mục [docs/diagrams/](./diagrams). Danh mục component bên dưới đại diện cho các khối kiến trúc logic trong hệ thống Next.js – NestJS – PostgreSQL – SePay.

## Danh mục sơ đồ

| Mã | Sơ đồ | Tệp lưu trữ | Phạm vi |
|---|---|---|---|
| **AD-01** | Activity Diagram – Luồng đặt hàng | [activity-diagram.svg](./diagrams/activity-diagram.svg) ([.png](./diagrams/activity-diagram.png)) | Luồng nghiệp vụ từ xem menu đến nhận đơn; gồm các nhánh nghiệp vụ liên quan. |
| **SD-01** | Sequence Diagram – Checkout (UC-01) | [sequence-checkout.svg](./diagrams/sequence-checkout.svg) ([.png](./diagrams/sequence-checkout.png), [.puml](./diagrams/sequence-checkout.puml)) | Tương tác Customer → Next.js → NestJS → PostgreSQL → SePay trong luồng đặt và thanh toán. |
| **CD-01** | Class Diagram – Domain Model | [class-diagram.svg](./diagrams/class-diagram.svg) ([.png](./diagrams/class-diagram-overall.png), [.puml](./diagrams/class-diagram.puml)) | Các lớp miền User, Product, Order, OrderItem, Payment, Promotion, LoyaltyTransaction và quan hệ giữa chúng. |
| **SM-01** | State Machine – Order | [order-state-machine.ts](../apps/api/src/orders/order-state-machine.ts) | Quy tắc chuyển trạng thái theo FR-11/FR-12; bằng chứng tại [kiểm thử tích hợp](../apps/api/test/order-state-machine.e2e-spec.ts). |

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

## Ánh xạ FR sang Thiết kế, Mã nguồn và Kiểm thử (Traceability Matrix)

Bảng ma trận truy vết tuân thủ định dạng chuẩn 5 cột theo quy định tại **Mục 8.1 (Assignment 2)**:

| Mã yêu cầu | Use-case / User Story | Thiết kế / Sơ đồ | Mã nguồn / API (Code) | Ca kiểm thử (Test ID) |
|---|---|---|---|---|
| **FR-01** Xem menu sản phẩm | US-01 | AD-01, CD-01 (`Product`) | `GET /products`<br>`apps/web/src/components/menu/ProductGrid.tsx`<br>`apps/api/src/products/products.controller.ts` | `E2E-PROD-01`<br>`E2E-PROD-02`<br>`UT-PROD-01`<br>`UT-WEB-01` -> `05` |
| **FR-02** Xem chi tiết sản phẩm | US-02 | AD-01, CD-01 (`Product`) | `GET /products/:id`<br>Modal chi tiết trong `ProductGrid.tsx`<br>`apps/api/src/products/products.controller.ts` | `E2E-PROD-05`<br>`E2E-PROD-06`<br>`UT-PROD-02` |
| **FR-03** Chọn size và topping | US-03 | AD-01, CD-01 (`Product`, `OrderItem`) | *Sprint 2:* `ProductCustomizerModal.tsx`, `API-PRODUCT` | *Sprint 2:* `INT-PROD-03` |
| **FR-04** Thêm sản phẩm vào giỏ | US-04 | AD-01, CD-01 (`OrderItem`) | *Sprint 2:* `useCart.ts`, `CartDrawer.tsx` | *Sprint 2:* `UT-CART-01` |
| **FR-05** Cập nhật giỏ hàng | US-05 | AD-01, CD-01 (`OrderItem`) | *Sprint 2:* `useCart.ts` (`updateQuantity`) | *Sprint 2:* `UT-CART-02` |
| **FR-06** Xóa sản phẩm khỏi giỏ | US-06 | AD-01, CD-01 (`OrderItem`) | *Sprint 2:* `useCart.ts` (`removeItem`) | *Sprint 2:* `UT-CART-03` |
| **FR-07** Kiểm tra giỏ trước khi đặt | US-07 (tiền điều kiện), UC-01 | AD-01, SD-01 | `apps/web/src/components/checkout/CheckoutPageClient.tsx`<br>`apps/web/src/app/checkout/page.tsx` | `UT-CART-01` -> `04` |
| **FR-08** Nhập thông tin nhận đơn | US-07, UC-01 | AD-01, SD-01 | `apps/web/src/components/checkout/CheckoutPageClient.tsx` (Form thông tin khách hàng, bàn) | `UT-CART-04` |
| **FR-09** Xem lại thông tin đơn | US-07, UC-01 | AD-01, SD-01, CD-01 (`Order`, `OrderItem`) | `apps/web/src/components/checkout/CheckoutPageClient.tsx` (Tóm tắt đơn hàng, size, topping) | `UT-CART-01` -> `04` |
| **FR-10** Tạo đơn hàng | US-08, UC-01 | AD-01, SD-01, CD-01 (`Order`, `OrderItem`) | `POST /orders`<br>`apps/api/src/orders/orders.controller.ts`<br>`apps/web/src/components/checkout/CheckoutPageClient.tsx` | `INT-ORD-01`<br>`UT-ORD-01` |
| **FR-11** Theo dõi trạng thái đơn | US-09 | AD-01, SD-01, SM-01, CD-01 (`Order`) | *Sprint 2:* `GET /orders/:id/status`, `OrderStatus.tsx` | *Sprint 2:* `E2E-ORD-02` |
| **FR-12** Cập nhật trạng thái đơn | US-10 | AD-01, SM-01, CD-01 (`Order`, `User`) | `GET /staff/orders`, `GET /staff/orders/:id`<br>`PATCH /staff/orders/:id/status`, `PATCH /orders/:id/status`<br>`staff/staff.controller.ts`, `staff/staff.service.ts`<br>`JwtAuthGuard` + `RolesGuard` (`BARISTA`/`ADMIN`)<br>`orders/order-state-machine.ts` (`assertTransition`)<br>`orders/order-transition.ts` (khóa dòng, transaction) | `UT-SM-01..03`<br>`UT-ORD-04..07`<br>`INT-SM-01..12`<br>`INT-STAFF-01..15` |
| **FR-13** Xem lịch sử đơn hàng | US-14 | CD-01 (`User`, `Order`) | *Sprint 2:* `GET /orders/history`, `OrderHistory.tsx` | *Sprint 2:* `INT-ORD-06` |
| **FR-14** Đăng ký tài khoản | US-13 | CD-01 (`User`) | `POST /auth/register`<br>`apps/api/src/auth/auth.service.ts` | `UT-AUTH-01`<br>`UT-AUTH-04` |
| **FR-15** Đăng nhập tài khoản | US-13 | SD-01, CD-01 (`User`) | `POST /auth/login`<br>`apps/api/src/auth/auth.service.ts` | `UT-AUTH-02`<br>`UT-AUTH-03` |
| **FR-16** Đăng xuất tài khoản | US-13 | CD-01 (`User`) | Phía Client xóa token xác thực | `UT-AUTH-03` |
| **FR-17** Xác thực truy cập bằng JWT | UC-01 (xác thực), US-10 | SD-01, CD-01 (`User`) | `JwtAuthGuard`, `AuthService.verifyToken`, `RolesGuard`<br>`apps/api/src/common/guards/jwt-auth.guard.ts`<br>`apps/api/src/staff/staff.controller.ts` | `UT-AUTH-02`<br>`INT-STAFF-01..04`, `INT-STAFF-15` |
| **FR-18** Chọn phương thức thanh toán | US-11, UC-01 | AD-01, SD-01, CD-01 (`Payment`) | `POST /payments/sepay/checkout`<br>`apps/web/src/components/checkout/CheckoutPageClient.tsx` (QR/Tiền mặt) | `UT-PAY-01` -> `03` |
| **FR-19** Xử lý thanh toán mô phỏng | US-12, UC-01 | SD-01, CD-01 (`Payment`, `Order`) | *Sprint 2:* `POST /payments/sepay/checkout`, SePay Gateway | *Sprint 2:* `INT-PAY-01` |
| **FR-20** Xác nhận kết quả thanh toán | US-12, UC-01 | SD-01, CD-01 (`Payment`, `Order`) | *Sprint 2:* `POST /payments/sepay/webhook-ipn` | *Sprint 2:* `INT-PAY-02` |
| **FR-21** Ngăn chặn thanh toán trùng lặp | US-12, UC-01 | SD-01, CD-01 (`Payment`) | *Sprint 2:* Idempotency Key Guard, `PaymentsService` | *Sprint 2:* `INT-PAY-03` |
| **NFR-HEALTH** Giám sát trạng thái hệ thống | Tiêu chí Sprint 1 | CD-01, Deployment Diagram | `GET /health`<br>`apps/api/src/health/health.controller.ts` | `E2E-HEALTH-01`<br>`E2E-HEALTH-02`<br>`UT-HEALTH-01` |
| **NFR-INVENTORY** Không bán vượt tồn kho khi đặt đồng thời; TTL giữ hàng (hỗ trợ FR-07, FR-10, FR-20) | US-07, US-08, US-12, UC-01 | Transaction, optimistic locking và TTL, SM-01 | `orders/orders.service.ts`<br>`inventory/stock-reservation.ts`<br>`inventory/inventory.service.ts`<br>`orders/order-transition.ts` | `UT-INV-01..16`<br>`INT-INV-01..16` |
| **UC-01 / AF-01** Áp mã giảm giá hợp lệ (hỗ trợ FR-09, FR-10, FR-19, FR-20) | UC-01, luồng thay thế AF-01 | SD-01, CD-01 (`Promotion`, `Order`), transaction | `POST /promotions/validate`, `POST /orders` (`promotionCode`)<br>`promotions/promotions.service.ts`<br>`orders/order-pricing.ts`<br>`payments/payments.service.ts`<br>`apps/web/src/components/checkout/CheckoutPageClient.tsx`, `PromotionCodeField.tsx`<br>`apps/web/src/lib/promotions.ts` | `UT-PROMO-01..06`<br>`INT-PROMO-01..14`<br>`UT-WEB-PROMO-01..11` |

## Ghi chú truy vết

- FR-12 gồm [quy tắc chuyển trạng thái](../apps/api/src/orders/order-state-machine.ts) và [kiểm thử tính nguyên tử](../apps/api/test/order-state-machine.e2e-spec.ts); API nhân viên và phân quyền `BARISTA`/`ADMIN` được mô tả và kiểm chứng tại [staff-api.md](./staff-api.md).

- US-07 bao gồm cả nhập thông tin và xem lại đơn (FR-08, FR-09); FR-07 là điều kiện để bắt đầu UC-01, không có User Story riêng.
- US-13 gộp đăng ký, đăng nhập và đăng xuất; US-14 ánh xạ tới FR-13. Không tạo mã User Story riêng cho từng FR trong các nhóm này.
- FR-16 theo SRS kết thúc phiên bằng cách xóa thông tin xác thực ở frontend; do đó component được ánh xạ trực tiếp là WEB-AUTH.
- Các component là ranh giới trách nhiệm logic để phục vụ thiết kế Task 3. Khi kiến trúc/module được chốt hoặc triển khai, cập nhật mã component tương ứng để tiếp tục truy vết tới mã nguồn và kiểm thử.
