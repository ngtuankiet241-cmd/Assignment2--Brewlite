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

**Cập nhật kiểm thử ngày 17/11/2026:** Các Test ID bên dưới được đối chiếu với test hiện có và liên kết tới tệp triển khai. Ký hiệu `..` biểu thị dải Test ID; một Test ID có thể gồm nhiều ca kiểm thử cho các dữ liệu hoặc nhánh xử lý khác nhau.

| Mã yêu cầu | Use-case / User Story | Thiết kế / Sơ đồ | Mã nguồn / API (Code) | Ca kiểm thử (Test ID) |
|---|---|---|---|---|
| **FR-01** Xem menu sản phẩm | US-01 | AD-01, CD-01 (`Product`) | `GET /products`<br>`apps/web/src/components/menu/ProductGrid.tsx`<br>`apps/api/src/products/products.controller.ts` | [E2E-PROD-01..02](../apps/api/test/products.e2e-spec.ts)<br>[UT-PROD-01](../apps/api/src/products/products.service.spec.ts)<br>[UT-WEB-01..05](../apps/web/test/menu.test.mjs) |
| **FR-02** Xem chi tiết sản phẩm | US-02 | AD-01, CD-01 (`Product`) | `GET /products/:id`<br>Modal chi tiết trong `ProductGrid.tsx`<br>`apps/api/src/products/products.controller.ts` | [E2E-PROD-05..06](../apps/api/test/products.e2e-spec.ts)<br>[UT-PROD-02](../apps/api/src/products/products.service.spec.ts) |
| **FR-03** Chọn size và topping | US-03 | AD-01, CD-01 (`Product`, `OrderItem`) | `GET /products/configuration`<br>`apps/web/src/components/menu/ProductConfigurator.tsx`<br>`apps/api/src/orders/order-pricing.ts` | [INT-PROD-03](../apps/api/test/traceability.e2e-spec.ts)<br>[UT-CART-PRICE-02..03](../apps/web/test/cart.test.mjs) |
| **FR-04** Thêm sản phẩm vào giỏ | US-04 | AD-01, CD-01 (`OrderItem`) | `apps/web/src/context/CartContext.tsx` (`addItem`)<br>`apps/web/src/context/useCart.ts` | [UT-CART-01](../apps/web/test/cart-provider.test.mjs) |
| **FR-05** Cập nhật giỏ hàng | US-05 | AD-01, CD-01 (`OrderItem`) | `apps/web/src/context/CartContext.tsx` (`updateQuantity`) | [UT-CART-02](../apps/web/test/cart-provider.test.mjs) |
| **FR-06** Xóa sản phẩm khỏi giỏ | US-06 | AD-01, CD-01 (`OrderItem`) | `apps/web/src/context/CartContext.tsx` (`removeItem`) | [UT-CART-03](../apps/web/test/cart-provider.test.mjs) |
| **FR-07** Kiểm tra giỏ trước khi đặt | US-07 (tiền điều kiện), UC-01 | AD-01, SD-01 | `apps/web/src/components/checkout/CheckoutPageClient.tsx`<br>`apps/web/src/app/checkout/page.tsx` | [UT-CART-04](../apps/web/test/checkout-auth.test.mjs) (giỏ trống)<br>[UT-ORD-02](../apps/api/src/orders/orders.service.spec.ts) (đơn không có món)<br>[INT-INV-04..05](../apps/api/test/inventory.e2e-spec.ts) (số lượng không hợp lệ, hết tồn kho) |
| **FR-08** Nhập thông tin nhận đơn | US-07, UC-01 | AD-01, SD-01 | `apps/web/src/components/checkout/CheckoutPageClient.tsx` (Form thông tin khách hàng, bàn) | [UT-CART-04](../apps/web/test/checkout-auth.test.mjs) (trường bắt buộc, chuẩn hóa payload)<br>[INT-ORD-01](../apps/api/test/traceability.e2e-spec.ts) (lưu thông tin nhận đơn) |
| **FR-09** Xem lại thông tin đơn | US-07, UC-01 | AD-01, SD-01, CD-01 (`Order`, `OrderItem`) | `apps/web/src/components/checkout/CheckoutPageClient.tsx` (Tóm tắt đơn hàng, size, topping) | [UT-CART-04](../apps/web/test/checkout-auth.test.mjs) (hiển thị món, tùy chọn và tổng tiền)<br>[UT-CART-PRICE-01..04](../apps/web/test/cart.test.mjs)<br>[INT-PROD-03, INT-ORD-01](../apps/api/test/traceability.e2e-spec.ts) (giá và snapshot do backend xác thực) |
| **FR-10** Tạo đơn hàng | US-08, UC-01 | AD-01, SD-01, CD-01 (`Order`, `OrderItem`) | `POST /orders`<br>`apps/api/src/orders/orders.controller.ts`<br>`apps/web/src/components/checkout/CheckoutPageClient.tsx` | [INT-ORD-01](../apps/api/test/traceability.e2e-spec.ts)<br>[UT-ORD-01](../apps/api/src/orders/orders.service.spec.ts)<br>[E2E-ORD-01](../apps/api/test/orders.e2e-spec.ts)<br>[INT-IDEM-01..02](../apps/api/test/idempotency.e2e-spec.ts) |
| **FR-11** Theo dõi trạng thái đơn | US-09 | AD-01, SD-01, SM-01, CD-01 (`Order`) | `GET /orders/:id/status`<br>`apps/api/src/orders/orders.service.ts` (`getStatus`)<br>`apps/web/src/components/orders/OrdersPageClient.tsx` | [E2E-ORD-02](../apps/api/test/traceability.e2e-spec.ts)<br>[UT-ORD-03](../apps/api/src/orders/orders.service.spec.ts) |
| **FR-12** Cập nhật trạng thái đơn | US-10 | AD-01, SM-01, CD-01 (`Order`, `User`) | `GET /staff/orders`, `GET /staff/orders/:id`<br>`PATCH /staff/orders/:id/status`, `PATCH /orders/:id/status`<br>`staff/staff.controller.ts`, `staff/staff.service.ts`<br>`JwtAuthGuard` + `RolesGuard` (`BARISTA`/`ADMIN`)<br>`orders/order-state-machine.ts` (`assertTransition`)<br>`orders/order-transition.ts` (khóa dòng, transaction) | [UT-SM-01..03](../apps/api/src/orders/order-state-machine.spec.ts)<br>[UT-ORD-04..07](../apps/api/src/orders/orders.service.spec.ts)<br>[INT-SM-01..12](../apps/api/test/order-state-machine.e2e-spec.ts)<br>[INT-STAFF-01..15](../apps/api/test/staff.e2e-spec.ts) |
| **FR-13** Xem lịch sử đơn hàng | US-14 | CD-01 (`User`, `Order`) | `GET /orders/history`<br>`apps/api/src/orders/orders.service.ts` (`getHistory`)<br>`apps/web/src/components/orders/OrdersPageClient.tsx` | [INT-ORD-06](../apps/api/test/traceability.e2e-spec.ts) (đúng tài khoản, thứ tự thời gian, lịch sử rỗng, JWT không hợp lệ) |
| **FR-14** Đăng ký tài khoản | US-13 | CD-01 (`User`) | `POST /auth/register`<br>`apps/api/src/auth/auth.service.ts` | [UT-AUTH-01, UT-AUTH-04](../apps/api/src/auth/auth.service.spec.ts) |
| **FR-15** Đăng nhập tài khoản | US-13 | SD-01, CD-01 (`User`) | `POST /auth/login`<br>`apps/api/src/auth/auth.service.ts` | [UT-AUTH-02..03](../apps/api/src/auth/auth.service.spec.ts) |
| **FR-16** Đăng xuất tài khoản | US-13 | CD-01 (`User`) | `apps/web/src/lib/auth.ts` (`clearAuthSession`)<br>`apps/web/src/hooks/useAuth.ts` | [UT-WEB-AUTH-01](../apps/web/test/auth.test.mjs) (xóa token/user, thông báo phiên đã kết thúc, giữ giỏ hàng) |
| **FR-17** Xác thực truy cập bằng JWT | UC-01 (xác thực), US-10 | SD-01, CD-01 (`User`) | `JwtAuthGuard`, `AuthService.verifyToken`, `RolesGuard`<br>`apps/api/src/common/guards/jwt-auth.guard.ts`<br>`apps/api/src/staff/staff.controller.ts` | [UT-AUTH-02](../apps/api/src/auth/auth.service.spec.ts)<br>[INT-STAFF-01..04, INT-STAFF-15](../apps/api/test/staff.e2e-spec.ts)<br>[INT-ORD-06](../apps/api/test/traceability.e2e-spec.ts) (thiếu JWT, JWT sai hoặc hết hạn) |
| **FR-18** Chọn phương thức thanh toán | US-11, UC-01 | AD-01, SD-01, CD-01 (`Payment`) | `POST /payments/sepay/checkout`, `POST /payments/sepay/checkout-form`<br>`apps/web/src/components/checkout/CheckoutPageClient.tsx` (QR/Tiền mặt) | [UT-WEB-PAY-01](../apps/web/test/checkout-auth.test.mjs) (lựa chọn phương thức và gửi yêu cầu SePay)<br>[INT-PAY-01](../apps/api/test/traceability.e2e-spec.ts) (lưu phương thức SePay và số tiền) |
| **FR-19** Xử lý thanh toán mô phỏng | US-12, UC-01 | SD-01, CD-01 (`Payment`, `Order`) | `POST /payments/sepay/checkout`<br>`apps/api/src/payments/payments.service.ts` (`createCheckout`, `handleWebhookIpn`) | [INT-PAY-01](../apps/api/test/traceability.e2e-spec.ts)<br>[UT-PAY-01, UT-PAY-04](../apps/api/src/payments/payments.service.spec.ts)<br>[INT-SM-06](../apps/api/test/order-state-machine.e2e-spec.ts) (thử lại sau thanh toán lỗi) |
| **FR-20** Xác nhận kết quả thanh toán | US-12, UC-01 | SD-01, CD-01 (`Payment`, `Order`) | `POST /payments/sepay/webhook-ipn`<br>`apps/api/src/payments/payments.service.ts` (`handleGatewayIpn`) | [INT-PAY-02](../apps/api/test/traceability.e2e-spec.ts)<br>[UT-PAY-03..08](../apps/api/src/payments/payments.service.spec.ts)<br>[E2E-ORD-01](../apps/api/test/orders.e2e-spec.ts) |
| **FR-21** Ngăn chặn thanh toán trùng lặp | US-12, UC-01 | SD-01, CD-01 (`Payment`) | `withIdempotency`, `OrdersService`, `PaymentsService`, `IdempotencyRecord` | [UT-ORD-IDEM-01](../apps/api/src/orders/orders.service.spec.ts)<br>[UT-PAY-02, UT-PAY-IDEM-01](../apps/api/src/payments/payments.service.spec.ts)<br>[INT-IDEM-01..12, INT-IDEM-AUTH, INT-IDEM-FORM, INT-PAY-03](../apps/api/test/idempotency.e2e-spec.ts) |
| **NFR-HEALTH** Giám sát trạng thái hệ thống | Tiêu chí Sprint 1 | CD-01, Deployment Diagram | `GET /health`<br>`apps/api/src/health/health.controller.ts` | [E2E-HEALTH-01..02](../apps/api/test/health.e2e-spec.ts)<br>[UT-HEALTH-01](../apps/api/src/health/health.service.spec.ts) |
| **NFR-INVENTORY** Không bán vượt tồn kho khi đặt đồng thời; TTL giữ hàng (hỗ trợ FR-07, FR-10, FR-20) | US-07, US-08, US-12, UC-01 | Transaction, optimistic locking và TTL, SM-01 | `orders/orders.service.ts`<br>`inventory/stock-reservation.ts`<br>`inventory/inventory.service.ts`<br>`orders/order-transition.ts` | [UT-INV-01..08](../apps/api/src/inventory/stock-reservation.spec.ts)<br>[UT-INV-09..16](../apps/api/src/inventory/inventory.service.spec.ts)<br>[INT-INV-01..16, INT-INV-12B](../apps/api/test/inventory.e2e-spec.ts) |
| **UC-01 / AF-01** Áp mã giảm giá hợp lệ (hỗ trợ FR-09, FR-10, FR-19, FR-20) | UC-01, luồng thay thế AF-01 | SD-01, CD-01 (`Promotion`, `Order`), transaction | `POST /promotions/validate`, `POST /orders` (`promotionCode`)<br>`promotions/promotions.service.ts`<br>`orders/order-pricing.ts`<br>`payments/payments.service.ts`<br>`apps/web/src/components/checkout/CheckoutPageClient.tsx`, `PromotionCodeField.tsx`<br>`apps/web/src/lib/promotions.ts` | [UT-PROMO-01..06](../apps/api/src/promotions/promotions.service.spec.ts)<br>[INT-PROMO-01..14](../apps/api/test/promotions.e2e-spec.ts)<br>[UT-WEB-PROMO-01..11](../apps/web/test/promotions.test.mjs) |

## Ghi chú truy vết

- **Đồng bộ kiểm thử (17/11/2026):** [Test tích hợp bổ sung](../apps/api/test/traceability.e2e-spec.ts) triển khai `INT-PROD-03`, `INT-ORD-01`, `E2E-ORD-02`, `INT-ORD-06`, `INT-PAY-01..02`. [Test CartProvider](../apps/web/test/cart-provider.test.mjs) kiểm tra thao tác thêm/sửa/xóa bằng mã nguồn thật; [test checkout](../apps/web/test/checkout-auth.test.mjs) kiểm tra giỏ trống, thông tin nhận đơn, xem lại đơn và lựa chọn thanh toán. `UT-CART-PRICE-01..04` là các test tính giá, tách khỏi `UT-CART-01..03` kiểm tra thao tác giỏ hàng. `UT-AUTH-03` chỉ thuộc FR-15 (đăng nhập sai mật khẩu); FR-16 dùng `UT-WEB-AUTH-01`.

- **Phạm vi FR-18:** Test frontend kiểm tra lựa chọn QR/Tiền mặt và yêu cầu checkout SePay khi chọn QR. Test tích hợp xác nhận phương thức `SEPAY_QR` được lưu; chưa có bằng chứng hoàn tất thanh toán tiền mặt, vì nhánh này hiện báo chưa được hỗ trợ.

- **Loyalty (2026-11-15, cập nhật 2026-11-16):** Tích 1 điểm / 1.000đ thực trả sau giảm giá khi `PAID`; đổi 1 điểm = 100đ khi tạo đơn. Điểm hiện tại nằm cạnh giỏ hàng trong `Header`, nhập điểm tại `LoyaltyRedemptionField`; không có trang loyalty riêng. Backend trừ điểm nguyên tử, hoàn điểm một lần khi hủy/hết hạn và xác nhận tại hệ thống nếu tổng tiền còn 0đ. Kiểm chứng bằng [unit test](../apps/api/src/loyalty/loyalty-points.spec.ts), [test tích điểm](../apps/api/test/loyalty.e2e-spec.ts), [test đổi điểm](../apps/api/test/loyalty-redemption.e2e-spec.ts), [test frontend](../apps/web/test/loyalty-ui.test.mjs).

- FR-12 gồm [quy tắc chuyển trạng thái](../apps/api/src/orders/order-state-machine.ts) và [kiểm thử tính nguyên tử](../apps/api/test/order-state-machine.e2e-spec.ts); API nhân viên và phân quyền `BARISTA`/`ADMIN` được mô tả và kiểm chứng tại [staff-api.md](./staff-api.md).

- US-07 bao gồm cả nhập thông tin và xem lại đơn (FR-08, FR-09); FR-07 là điều kiện để bắt đầu UC-01, không có User Story riêng.
- US-13 gộp đăng ký, đăng nhập và đăng xuất; US-14 ánh xạ tới FR-13. Không tạo mã User Story riêng cho từng FR trong các nhóm này.
- FR-16 theo SRS kết thúc phiên bằng cách xóa thông tin xác thực ở frontend; do đó component được ánh xạ trực tiếp là WEB-AUTH.
- Các component là ranh giới trách nhiệm logic để phục vụ thiết kế Task 3. Khi kiến trúc/module được chốt hoặc triển khai, cập nhật mã component tương ứng để tiếp tục truy vết tới mã nguồn và kiểm thử.
