# 🧪 Tests Directory – BrewLite Integration & E2E Testing

Thư mục `tests/` ở thư mục gốc chứa các bộ kiểm thử tích hợp (Integration) và kiểm thử đầu-cuối (End-to-End Smoke Test) cho toàn bộ hệ thống **BrewLite** theo đúng quy định cấu trúc Repository của Assignment 2.

Kiểm thử tồn kho đồng thời qua **HTTP + PostgreSQL thật** nằm tại `apps/api/test/inventory.e2e-spec.ts`. Chạy `npm.cmd --prefix apps/api run test:e2e -- inventory`. Bộ test này tự tạo và xóa schema riêng, không xóa bảng dữ liệu ứng dụng.

Kiểm thử API nhân viên, JWT/RBAC, lọc/phân trang và cập nhật trạng thái nằm tại `apps/api/test/staff.e2e-spec.ts`. Chạy `npm.cmd --prefix apps/api run test:e2e -- staff`. Xem [hướng dẫn API `/staff`](../docs/staff-api.md).

Kiểm thử áp mã giảm giá, tính giá từ backend, rollback và thanh toán đúng số tiền sau giảm nằm tại [apps/api/test/promotions.e2e-spec.ts](../apps/api/test/promotions.e2e-spec.ts). Chạy `npm.cmd --prefix apps/api run test:e2e -- promotions`.

Kiểm thử client API khuyến mãi và các trạng thái giao diện nhập mã nằm tại [apps/web/test/promotions.test.mjs](../apps/web/test/promotions.test.mjs). Chạy `npm.cmd --prefix apps/web test`.

Kiểm thử `Idempotency-Key` qua **HTTP + PostgreSQL thật** nằm tại [apps/api/test/idempotency.e2e-spec.ts](../apps/api/test/idempotency.e2e-spec.ts). Chạy `npm.cmd --prefix apps/api run test:e2e -- idempotency`. `INT-IDEM-01` và `INT-IDEM-02` chứng minh gửi hai lần cùng key (tuần tự hoặc đồng thời) chỉ tạo **một đơn**, trừ kho **một lần**. `INT-PAY-03` kiểm tra thêm checkout/IPN lặp vẫn chỉ có một payment và không ghi nhận thanh toán lần hai. Các test còn lại bao phủ payload khác trả `409`, rollback, key cũ sau retry và tương thích header/body. Mỗi suite dùng schema riêng và tự xóa sau khi chạy.

Unit test gửi hai lần cùng key nằm trong `orders.service.spec.ts` (`UT-ORD-IDEM-01`) và `payments.service.spec.ts` (`UT-PAY-IDEM-01`). Test giữ key khi retry/tải lại trang nằm tại [apps/web/test/checkout-idempotency.test.mjs](../apps/web/test/checkout-idempotency.test.mjs).

Kiểm thử cộng điểm sau `PAID` nằm tại [apps/api/test/loyalty.e2e-spec.ts](../apps/api/test/loyalty.e2e-spec.ts), chạy `npm.cmd --prefix apps/api run test:e2e -- loyalty`. Bộ test HTTP + PostgreSQL kiểm tra **1 điểm / 1.000đ sau giảm giá**, cộng đúng một lần khi webhook lặp/đồng thời, tăng số dư nguyên tử giữa các đơn, rollback và chỉ đọc lịch sử của tài khoản đã xác thực. Unit test tính điểm nằm tại `apps/api/src/loyalty/loyalty-points.spec.ts`; client API và hiển thị số dư được kiểm tra tại `apps/web/test/loyalty.test.mjs`.

---

## 📁 Cấu trúc Thư mục

```text
tests/
├── api-e2e.test.mjs    # Bộ kiểm thử E2E tích hợp các luồng API: Health, Menu, Checkout, SePay QR
├── .gitkeep            # File giữ cấu trúc thư mục git
└── README.md           # Hướng dẫn thực thi kiểm thử
```

---

## 🚀 Hướng dẫn Chạy Kiểm thử

Bộ kiểm thử sử dụng trực tiếp **Node.js Test Runner tích hợp sẵn** (`node:test` & `node:assert/strict`), không yêu cầu cài đặt thêm thư viện phụ thuộc của bên thứ ba:

```bash
# Chạy toàn bộ kiểm thử trong thư mục tests/:
node --test tests/*.test.mjs
```

### Các nhóm ca kiểm thử (Test Suites):
1. **Health Check Endpoint (`E2E-HEALTH-01`, `02`):** Kiểm tra cấu trúc phản hồi và tính sẵn sàng của dịch vụ (`GET /health`).
2. **Products & Menu Flow (`E2E-PROD-01`, `02`):** Kiểm định tính toàn vẹn của mô hình sản phẩm và công thức tính đơn giá kèm tùy chọn Size và Topping.
3. **Order Placement Flow (`E2E-ORD-01`):** Kiểm tra tính hợp lệ của dữ liệu gửi lên (Payload), số điện thoại và tính nhất quán dữ liệu Snapshot.
4. **SePay Sandbox Payment & Idempotency (`E2E-PAY-01`, `02`):** Kiểm tra thuật toán sinh mã QR thanh toán ngân hàng và chu trình chuyển đổi trạng thái đơn hàng (`PENDING` $\rightarrow$ `PAID`).

