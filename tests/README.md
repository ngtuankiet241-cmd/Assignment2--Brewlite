# 🧪 Tests Directory – BrewLite Integration & E2E Testing

Thư mục `tests/` ở thư mục gốc chứa các bộ kiểm thử tích hợp (Integration) và kiểm thử đầu-cuối (End-to-End Smoke Test) cho toàn bộ hệ thống **BrewLite** theo đúng quy định cấu trúc Repository của Assignment 2.

Kiểm thử tồn kho đồng thời qua **HTTP + PostgreSQL thật** nằm tại `apps/api/test/inventory.e2e-spec.ts`. Chạy `npm.cmd --prefix apps/api run test:e2e -- inventory`. Bộ test này tự tạo và xóa schema riêng, không xóa bảng dữ liệu ứng dụng.

Kiểm thử API nhân viên, JWT/RBAC, lọc/phân trang và cập nhật trạng thái nằm tại `apps/api/test/staff.e2e-spec.ts`. Chạy `npm.cmd --prefix apps/api run test:e2e -- staff`. Xem [hướng dẫn API `/staff`](../docs/staff-api.md).

Kiểm thử áp mã giảm giá, tính giá từ backend, rollback và thanh toán đúng số tiền sau giảm nằm tại [apps/api/test/promotions.e2e-spec.ts](../apps/api/test/promotions.e2e-spec.ts). Chạy `npm.cmd --prefix apps/api run test:e2e -- promotions`.

Kiểm thử client API khuyến mãi và các trạng thái giao diện nhập mã nằm tại [apps/web/test/promotions.test.mjs](../apps/web/test/promotions.test.mjs). Chạy `npm.cmd --prefix apps/web test`.

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

