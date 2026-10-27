# Ma trận Truy vết Yêu cầu (Traceability Matrix) – BrewLite

Tài liệu này ánh xạ mối quan hệ xuyên suốt từ **Yêu cầu (FR) -> Use-case / User Story -> Thiết kế / Sơ đồ -> API / Mã nguồn -> Kiểm thử (Test Case)** theo quy định của môn học (Assignment 2 - Mục 8).

| Mã yêu cầu | Use-case / User Story | Thiết kế / Sơ đồ | Code / API | Kiểm thử (Test Case) |
|---|---|---|---|---|
| **FR-01** | US-01: Xem menu sản phẩm | Activity-01, Class-Product | `GET /products` | Unit: `products.service.spec.ts`<br/>E2E: `products.e2e-spec.ts` |
| **FR-02** | US-02: Xem chi tiết sản phẩm | Activity-01, Class-Product | `GET /products/:id` | Unit: `products.controller.spec.ts` |
| **FR-03** | US-03: Chọn size & topping | Activity-01, Class-Product | Frontend State | Component test: `ProductDetail.spec.tsx` |
| **FR-04** | US-04: Thêm vào giỏ hàng | Activity-01, Class-Order | LocalStorage / Context | Unit: `CartContext.spec.tsx` |
| **FR-05** | US-05: Cập nhật giỏ hàng | Activity-01, Class-Order | LocalStorage / Context | Unit: `CartContext.spec.tsx` |
| **FR-06** | US-06: Xóa món khỏi giỏ | Activity-01, Class-Order | LocalStorage / Context | Unit: `CartContext.spec.tsx` |
| **FR-07** | US-07: Kiểm tra giỏ hàng | Activity-01, Sequence-Checkout | Frontend Validation | Unit: `CheckoutValidation.spec.ts` |
| **FR-08** | US-08: Nhập thông tin nhận đơn | UC-01, Sequence-Checkout | Frontend Form | Unit: `OrderForm.spec.tsx` |
| **FR-09** | US-09: Xem lại thông tin đơn | UC-01, Sequence-Checkout | Frontend Review | Component: `OrderReview.spec.tsx` |
| **FR-10** | UC-01: Đặt và thanh toán | Sequence-Checkout, Class-Order | `POST /orders` | Unit: `orders.service.spec.ts`<br/>E2E: `orders.e2e-spec.ts` |
| **FR-11** | US-11: Theo dõi trạng thái | Activity-01, Class-Order | `GET /orders/:id` | Unit: `orders-status.service.spec.ts` |
| **FR-12** | US-12: Cập nhật trạng thái đơn | Class-Order, State Machine | `PATCH /orders/:id/status` | Unit: `order-state-machine.spec.ts` |
| **FR-13** | US-13: Lịch sử đơn hàng | Class-Order | `GET /orders` | E2E: `order-history.e2e-spec.ts` |
| **FR-14** | US-14: Đăng ký tài khoản | Class-User | `POST /auth/register` | Unit: `auth.service.spec.ts` |
| **FR-15** | US-15: Đăng nhập tài khoản | Class-User | `POST /auth/login` | Unit: `auth.service.spec.ts` |
| **FR-16** | US-16: Đăng xuất tài khoản | Class-User | `POST /auth/logout` | Unit: `auth.service.spec.ts` |
| **FR-17** | US-17: Xác thực JWT Guard | Sequence-Checkout | `JwtAuthGuard` | Unit: `jwt-auth.guard.spec.ts` |
| **FR-18** | UC-01: Chọn phương thức thanh toán | Sequence-Checkout, Class-Payment | Frontend Payment | Component: `PaymentMethod.spec.tsx` |
| **FR-19** | UC-01: Xử lý thanh toán sandbox | Sequence-Checkout, Class-Payment | `POST /payments/create` | Integration: `payments.service.spec.ts` |
| **FR-20** | UC-01: Xác nhận kết quả thanh toán | Sequence-Checkout, Class-Payment | `POST /payments/ipn` | E2E: `payments-ipn.e2e-spec.ts` |
| **FR-21** | UC-01: Ngăn chặn thanh toán trùng | Sequence-Checkout | `IdempotencyMiddleware` | Unit: `idempotency.spec.ts`<br/>E2E: `idempotency.e2e-spec.ts` |
