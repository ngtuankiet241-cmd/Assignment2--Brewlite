# Kiến trúc Hệ thống – BrewLite

Tài liệu mô tả kiến trúc phân tầng, lựa chọn công nghệ, sơ đồ triển khai và các quyết định kiến trúc chính của hệ thống **BrewLite** (Task 3 – Assignment 2).

---

## 1. Tổng quan Kiến trúc

BrewLite áp dụng kiến trúc **3 tầng phân tách rõ ràng** (Layered / N-Tier Architecture), triển khai theo mô hình **monorepo** với hai ứng dụng độc lập (`apps/web` và `apps/api`) chia sẻ cùng cơ sở hạ tầng.

```
┌───────────────────────────────────────────────────────────┐
│                     TẦNG PRESENTATION                     │
│              Next.js 14 PWA  (apps/web)                   │
│   Mobile-first UI · React Server Components · App Router  │
└──────────────────────────┬────────────────────────────────┘
                           │ HTTPS / REST API (JSON)
                           │ Authorization: Bearer <JWT>
┌──────────────────────────▼────────────────────────────────┐
│                      TẦNG NGHIỆP VỤ                       │
│               NestJS 10  (apps/api)                       │
│   Domain Modules · Guards/Pipes · RBAC · Prisma ORM       │
└──────────────────────────┬────────────────────────────────┘
                           │ Prisma Client (TCP)
         ┌─────────────────┼─────────────────┐
         ▼                                   ▼
┌────────────────────┐             ┌─────────────────────┐
│   TẦNG DỮ LIỆU    │             │  DỊCH VỤ BÊN NGOÀI  │
│  PostgreSQL 16     │             │   SePay Sandbox      │
│  (Managed DB)      │             │   Payment Gateway    │
└────────────────────┘             └─────────────────────┘
```

---

## 2. Mô tả từng Tầng

### 2.1 Tầng Presentation – Next.js 14 PWA

| Thuộc tính | Chi tiết |
|---|---|
| **Framework** | Next.js 14 (App Router, React Server Components) |
| **Ngôn ngữ** | TypeScript |
| **Giao diện** | Tailwind CSS, Mobile-first (≥ 375 px), PWA (Add to Home Screen) |
| **Trạng thái client** | React Context (giỏ hàng) + localStorage (token, cart) |
| **Giao tiếp backend** | REST API qua `fetch` / Axios; JWT được gắn vào `Authorization: Bearer` header |
| **URL sản xuất** | HTTPS (Vercel / Render) |

**Tổ chức thư mục `apps/web`:**
```
app/
  (auth)/          # layout riêng cho trang đăng nhập, đăng ký
  menu/            # danh sách sản phẩm
  product/[id]/    # chi tiết sản phẩm
  cart/            # giỏ hàng
  checkout/        # xác nhận đơn và thanh toán
  orders/          # lịch sử đơn hàng
  orders/[id]/     # theo dõi trạng thái đơn
components/
  ui/              # Button, Input, Skeleton, Toast…
  layout/          # Header, Footer, BottomNav
  domain/          # ProductCard, CartItem, OrderStatusBadge…
lib/
  api.ts           # axios instance + interceptor gắn JWT
  auth.ts          # helpers: lấy / lưu / xóa token
```

### 2.2 Tầng Nghiệp vụ – NestJS 10

| Thuộc tính | Chi tiết |
|---|---|
| **Framework** | NestJS 10 (Module-based) |
| **Ngôn ngữ** | TypeScript |
| **ORM** | Prisma 5 (type-safe, migration-first) |
| **Xác thực** | JWT (passport-jwt), bcrypt hash mật khẩu |
| **RBAC** | `@Roles()` decorator + `RolesGuard` – phân biệt `CUSTOMER` / `STAFF` |
| **Validation** | `class-validator` + `class-transformer` (DTO tự động validate) |
| **Anti-patterns** | Idempotency Middleware (ngăn double-submit) |

**Tổ chức module NestJS (`apps/api/src`):**
```
auth/             # AuthModule: đăng ký, đăng nhập, JWT Strategy
products/         # ProductsModule: CRUD sản phẩm, tồn kho
orders/           # OrdersModule: tạo đơn, lịch sử, state machine
payments/         # PaymentsModule: gọi SePay, IPN webhook, idempotency
users/            # UsersModule: hồ sơ người dùng
common/
  guards/         # JwtAuthGuard, RolesGuard
  decorators/     # @CurrentUser(), @Roles()
  middleware/     # IdempotencyMiddleware
  filters/        # AllExceptionsFilter
  interceptors/   # LoggingInterceptor
prisma/           # PrismaService + schema.prisma
```

**Sơ đồ trạng thái đơn hàng (State Machine):**
```
PENDING ──► CONFIRMED ──► PREPARING ──► READY ──► COMPLETED
   │             │              │          │
   └─────────────┴──────────────┴──────────┴──► CANCELLED
```
Mỗi bước chuyển trạng thái được kiểm tra bởi `OrderStateMachine` service; chỉ nhân viên (`STAFF`) có quyền gọi `PATCH /orders/:id/status`.

### 2.3 Tầng Dữ liệu – PostgreSQL 16

| Thuộc tính | Chi tiết |
|---|---|
| **RDBMS** | PostgreSQL 16 |
| **ORM / Migration** | Prisma Migrate (forward-only, version-controlled) |
| **ACID** | Transaction `$transaction([])` bao gồm kiểm tra tồn kho + tạo đơn + trừ stock |
| **Concurrency** | `SELECT … FOR UPDATE` (pessimistic locking) khi đặt đơn |
| **Triển khai local** | `docker-compose.yml` container `postgres:16-alpine` |
| **Triển khai production** | Managed PostgreSQL (Render / Railway) |

**Schema tóm tắt (Prisma):**
```
User            – id, email, passwordHash, role, loyaltyPoints
Product         – id, name, description, imageUrl, price, stock, isActive
ProductOption   – id, productId, type (SIZE|TOPPING), label, extraPrice
Order           – id, userId, status, totalAmount, recipientName, recipientPhone, note
OrderItem       – id, orderId, productId, snapshotName, snapshotPrice, quantity, selectedOptions (JSON)
Payment         – id, orderId, method, status, amount, transactionId, idempotencyKey
Promotion       – id, code, discountType, discountValue, expiresAt
LoyaltyTransaction – id, userId, type (EARN|REDEEM), points, description
```

> **Data Snapshotting:** `OrderItem` lưu lại `snapshotName` và `snapshotPrice` tại thời điểm đặt đơn. Khi giá sản phẩm thay đổi sau này, dữ liệu lịch sử đơn hàng không bị ảnh hưởng.

### 2.4 Dịch vụ bên ngoài – SePay Sandbox

- BrewLite giao tiếp với **SePay Payment Gateway Sandbox** thông qua REST API.
- NestJS gọi `POST /payment/create` sang SePay khi khách hàng xác nhận thanh toán.
- SePay gọi ngược **Webhook IPN** về `POST /payments/ipn` của NestJS để xác nhận kết quả.
- Môi trường sandbox: toàn bộ giao dịch là giả lập, không có tiền thật.

---

## 3. Sơ đồ Triển khai (Deployment Diagram)

```
                        Internet (HTTPS)
                               │
                    ┌──────────▼──────────┐
                    │   Vercel (CDN/Edge)  │
                    │   Next.js 14 PWA     │
                    │   apps/web           │
                    │   (Auto-deploy từ    │
                    │    GitHub main)      │
                    └──────────┬──────────┘
                               │ HTTPS REST
                               │ JWT Bearer
                    ┌──────────▼──────────┐
                    │   Render.com         │
                    │   NestJS 10 API      │
                    │   apps/api           │
                    │   Container: Node.js │
                    │   (Auto-deploy từ    │
                    │    GitHub main)      │
                    └────┬────────┬────────┘
                         │        │
          ┌──────────────▼─┐   ┌──▼──────────────┐
          │ Render Postgres │   │  SePay Sandbox   │
          │ PostgreSQL 16   │   │  Payment Gateway │
          │ (Managed DB)    │   │  (External API)  │
          └─────────────────┘   └──────────────────┘

──── Local Development ────────────────────────────────────
  docker-compose.yml
  ├── web    (Next.js)   → localhost:3000
  ├── api    (NestJS)    → localhost:3001
  └── db     (Postgres)  → localhost:5432
```

**Luồng CI/CD (GitHub Actions):**
```
git push → GitHub
    │
    ▼
[CI Pipeline – .github/workflows/ci.yml]
    ├── Lint (ESLint + Prettier)
    ├── Type-check (tsc --noEmit)
    ├── Unit Test (Jest)
    └── Build (next build + nest build)
         │ (chỉ khi CI PASS)
         ▼
    [CD – Auto Deploy]
    ├── Vercel  ← deploy apps/web
    └── Render  ← deploy apps/api
```

---

## 4. Các Quyết định Kiến trúc (Architecture Decision Records)

Các ADR chi tiết được lưu trong thư mục `docs/architecture/adr/`:

| Mã ADR | Tiêu đề | Trạng thái |
|---|---|:---:|
| [ADR-001](adr/ADR-001-nextjs-nestjs-split.md) | Tách Frontend (Next.js) và Backend (NestJS) thành hai ứng dụng riêng | Đã chấp thuận |
| [ADR-002](adr/ADR-002-postgresql-prisma.md) | Chọn PostgreSQL + Prisma ORM làm tầng dữ liệu | Đã chấp thuận |
| [ADR-003](adr/ADR-003-jwt-authentication.md) | Xác thực bằng JWT stateless | Đã chấp thuận |
| [ADR-004](adr/ADR-004-idempotency-payment.md) | Kiểm soát Idempotency cho luồng thanh toán | Đã chấp thuận |

---

## 5. Nguyên tắc Thiết kế Xuyên suốt

| Nguyên tắc | Áp dụng trong BrewLite |
|---|---|
| **Separation of Concerns** | Frontend (UI/UX) hoàn toàn tách biệt Backend (business logic) |
| **Fail Fast** | Validation DTO ở cổng vào (NestJS Pipe); từ chối request sớm trước khi vào DB |
| **Idempotency** | Mọi endpoint tạo đơn và thanh toán hỗ trợ Idempotency-Key |
| **Security by Default** | JWT Guard bật mặc định; endpoints public phải khai báo `@Public()` rõ ràng |
| **Data Integrity** | Tất cả thao tác ghi có side-effect bọc trong Prisma `$transaction` |
| **Observable** | Log request/response qua LoggingInterceptor; endpoint `/health` để kiểm tra sức khoẻ |

