# ADR-002 – Chọn PostgreSQL + Prisma ORM làm tầng dữ liệu

| Trường | Nội dung |
|---|---|
| **Mã ADR** | ADR-002 |
| **Ngày** | 2026-10-28 |
| **Trạng thái** | Đã chấp thuận (Accepted) |
| **Tác giả** | Hùng (Backend/DevOps), Kiệt (Team Lead) |

---

## Bối cảnh (Context)

Hệ thống BrewLite cần lưu trữ dữ liệu quan hệ chặt chẽ: User, Product, Order, OrderItem, Payment với các ràng buộc toàn vẹn dữ liệu (Foreign Key, Unique Constraint) và yêu cầu ACID transaction mạnh (tạo đơn + trừ kho + ghi payment trong cùng 1 transaction).

Câu hỏi cần quyết định: **Nên dùng RDBMS hay NoSQL? ORM hay Query Builder?**

---

## Quyết định (Decision)

Chọn **PostgreSQL 16** làm hệ quản trị cơ sở dữ liệu và **Prisma 5** làm ORM/Migration tool.

---

## Lý do (Rationale)

### Vì sao PostgreSQL thay vì NoSQL (MongoDB)?

| Tiêu chí | PostgreSQL | MongoDB |
|---|---|---|
| ACID Transaction | ✅ Native, toàn diện | Partial (4.x+, phức tạp hơn) |
| Quan hệ dữ liệu (FK) | ✅ Native FK + JOIN | Không có FK thực, phải tự quản |
| Tính nhất quán đơn hàng | ✅ Đảm bảo tuyệt đối | Cần thiết kế thêm |
| Phù hợp dữ liệu có schema cố định | ✅ Phù hợp hoàn toàn | Thừa sức linh hoạt không cần thiết |
| Hỗ trợ `SELECT FOR UPDATE` | ✅ Pessimistic locking | Không tương đương trực tiếp |
| Managed service miễn phí | Render, Railway | MongoDB Atlas |

PostgreSQL phù hợp tự nhiên với domain của BrewLite: dữ liệu có schema rõ ràng, quan hệ chặt chẽ, yêu cầu transaction phức tạp.

### Vì sao Prisma thay vì TypeORM hay knex.js?

| Tiêu chí | Prisma 5 | TypeORM | knex.js |
|---|---|---|---|
| Type-safety | ✅ Tự động sinh type từ schema | Partial (dễ mất đồng bộ) | Thấp |
| Migration | ✅ `prisma migrate` rõ ràng | Phức tạp, dễ lỗi | Thủ công hoàn toàn |
| Developer Experience | ✅ Schema-first, Prisma Studio | Decorator-heavy | SQL-centric |
| Tích hợp NestJS | ✅ `@prisma/client` + `PrismaService` | ✅ TypeORM module | Cần wrapping tay |
| Tài liệu & cộng đồng | ✅ Tốt | Tốt | Tốt |

Prisma loại bỏ hoàn toàn lớp "impedance mismatch" – schema định nghĩa một lần trong `schema.prisma`, type TypeScript được sinh tự động, không bao giờ bị lệch.

---

## Hệ quả (Consequences)

**Tích cực:**
- `PrismaClient` hoàn toàn type-safe, lỗi schema được phát hiện ngay lúc compile.
- `prisma migrate dev` tạo SQL migration file được version control cùng codebase.
- `Prisma.$transaction([...])` kết hợp pessimistic locking (`FOR UPDATE`) đáp ứng yêu cầu FR-10 (tạo đơn an toàn đồng thời).
- Dễ dàng seed dữ liệu bằng `prisma db seed` cho môi trường development và test.

**Tiêu cực / Đánh đổi:**
- Prisma không hỗ trợ một số tính năng PostgreSQL nâng cao (Materialized View, custom PostgreSQL function) – không ảnh hưởng đến phạm vi MVP.
- `PrismaClient` nên được khởi tạo dưới dạng singleton (qua `PrismaService` trong NestJS) để tránh connection pool leak.

---

## Quy ước áp dụng

1. **Tất cả thay đổi schema** phải qua `prisma migrate dev`, commit file migration vào git.
2. **Không dùng `prisma db push`** trong môi trường production; chỉ dùng `prisma migrate deploy`.
3. **`$transaction`** bắt buộc cho mọi luồng ghi có side-effect: tạo đơn hàng, trừ tồn kho, cập nhật payment.
4. **`SELECT FOR UPDATE`** áp dụng khi đọc `Product.stock` trong luồng đặt đơn để ngăn race condition.

