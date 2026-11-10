# 🚀 Kiến trúc và Hướng dẫn Triển khai Production – BrewLite (Task 3.2)

Tài liệu này đặc tả chi tiết kiến trúc triển khai trên môi trường Production của hệ thống **BrewLite** theo tiêu chuẩn UML Deployment Diagram (Task 3.2 – Assignment 2).

---

## 1. Sơ đồ Triển khai Hệ thống (UML Deployment Diagram)

Sơ đồ mô tả cấu trúc vật lý và logic của hệ thống BrewLite trên môi trường vận hành thực tế:

![UML Deployment Diagram](diagrams/deployment-diagram.png)

*Mã nguồn sơ đồ:* [`docs/diagrams/deployment-diagram.puml`](diagrams/deployment-diagram.puml)

---

## 2. Chi tiết các Node và Thành phần Hệ thống

### 2.1 Môi trường Khách hàng (Client Environment)
- **Thiết bị người dùng (`ClientDevice`):** Điện thoại thông minh (iOS/Android) hoặc máy tính cá nhân.
- **Trình duyệt & PWA Shell:**
  - Chạy ứng dụng web giao diện Next.js mobile-first.
  - Hỗ trợ chuẩn PWA (Progressive Web App): có khả năng lưu màn hình chính (*Add to Home Screen*), service worker cache tài nguyên tĩnh.
  - **Client Storage:** Sử dụng `localStorage` lưu phiên làm việc (JWT Token) và đồng bộ trạng thái giỏ hàng khi người dùng chưa hoàn tất đơn.

### 2.2 Mạng phân phối Frontend (`Vercel Global Edge Network`)
- **Nền tảng:** Vercel Edge Network tích hợp Global CDN.
- **Thành phần:** `apps/web` (Next.js 14 App Router, React Server Components).
- **Cơ chế hoạt động:**
  - Tự động biên dịch và phân phối các tệp tĩnh (HTML, CSS, JS bundle, hình ảnh) đến các PoP (Point of Presence) gần người dùng nhất.
  - Hỗ trợ Server-Side Rendering (SSR) cho các trang yêu cầu SEO và nạp trước dữ liệu thực đơn (Menu).
  - Tự động kích hoạt quy trình triển khai thông qua GitHub webhook mỗi khi nhánh `main` được cập nhật.
- **Giao thức & Cổng:** HTTPS / TLS 1.3 qua cổng chuẩn `443`.

### 2.3 Nền tảng Backend Container (`Render.com PaaS Cloud`)
- **Nền tảng:** Render.com Cloud Platform chạy Dockerized Web Service.
- **Container Dịch vụ API (`apps/api`):**
  - **Runtime:** Node.js 20 LTS chạy trên nền Linux Container (`alpine`).
  - **Framework:** NestJS 10 tổ chức theo kiến trúc module hướng miền (Domain-Driven Modules).
  - **Cổng dịch vụ:** Chạy nội bộ tại cổng `3001`, được Render SSL Reverse Proxy chuyển tiếp an toàn ra cổng `443` (HTTPS).
  - **Cơ chế ORM:** Prisma 5 với Connection Pooling, quản lý truy vấn tối ưu và xử lý giao dịch ACID bằng khóa bi quan `SELECT ... FOR UPDATE`.
  - **Health Check Endpoint:** `GET /health` phản hồi trạng thái ứng dụng (`200 OK`) phục vụ giám sát uptime và rolling deployment không gián đoạn (zero-downtime).
  - **Logging & Monitoring:** Bắt toàn bộ luồng request/response qua `LoggingInterceptor`, xuất nhật ký ra `stdout` và được Render Log Stream thu thập tập trung.

### 2.4 Máy chủ Cơ sở Dữ liệu (`Render Managed PostgreSQL 16`)
- **Phiên bản:** PostgreSQL 16.
- **Lưu trữ dữ liệu bền vững (Persistent Storage):** Gắn đĩa lưu trữ khối được mã hóa (Encrypted Persistent Disk) với chính sách sao lưu định kỳ hàng ngày (Automated Daily Backups).
- **Mạng bảo mật nội bộ:** Kết nối qua mạng riêng ảo của Render (Private Network), không mở IP public trực tiếp ra Internet. NestJS API kết nối qua chuỗi kết nối nội bộ cổng `5432` có mã hóa TLS/SSL.

### 2.5 Dịch vụ Thanh toán Bên ngoài (`SePay Sandbox Gateway`)
- **Mục đích:** Cổng thanh toán trực tuyến mô phỏng giao dịch chuyển khoản / thẻ không dùng tiền mặt.
- **Luồng tích hợp:**
  - API NestJS gửi yêu cầu tạo giao dịch qua `POST /payment/create` (kèm chữ ký bảo mật và API Key).
  - Khách hàng thực hiện thanh toán trên giao diện sandbox giả lập.
  - SePay gửi thông báo trạng thái thanh toán theo thời gian thực về NestJS API thông qua Webhook IPN (`POST /payments/ipn`), được xác thực bằng chữ ký bí mật `SEPAY_WEBHOOK_SECRET`.

---

## 3. Ranh giới giữa các Môi trường (Environment Boundaries)

| Tiêu chí | Môi trường Local Development | Môi trường CI / Testing | Môi trường Production |
|---|---|---|---|
| **Cơ sở hạ tầng** | Docker Compose trên máy lập trình viên | Ubuntu Linux VM (GitHub Actions Runner) | Vercel Edge + Render.com PaaS |
| **Frontend Web** | `localhost:3000` (Node dev server) | Build test (`next build`) | Vercel Global CDN (HTTPS) |
| **Backend API** | `localhost:3001` (Nest dev watch) | Unit/Integration Test (`jest`) | Render Docker Container (HTTPS) |
| **Cơ sở dữ liệu** | Docker container `postgres:16-alpine` | PostgreSQL Test DB (ephemeral / service container) | Managed PostgreSQL 16 (Persistent Disk) |
| **Thanh toán** | Mock Service nội bộ / SePay Test API | Mock Provider (Jest Mock / WireMock) | SePay Sandbox Gateway |
| **Biến môi trường** | File `.env.local` không commit | GitHub Repository Secrets | Render Dashboard / Vercel Environment Variables |

---

## 4. Quản lý Secret & Biến môi trường Production

Tất cả các biến môi trường nhạy cảm đều được mã hóa và cấu hình trực tiếp trên Dashboard của Render và Vercel, tuyệt đối không lưu vết trong kho mã nguồn Git hay log CI:

```bash
# Cấu hình trên Render.com (Backend API):
NODE_ENV=production
PORT=3001
DATABASE_URL=postgres://brewlite_user:********@dpg-xxxxxx-a.oregon-postgres.render.com/brewlite_db?sslmode=require
JWT_SECRET=c8d3f1a94e82b75f0a2d6e3c5b8a9147d3e2f1a0b5c4d6e8
JWT_EXPIRES_IN=1d
SEPAY_API_KEY=sepay_live_api_key_sandbox_****************
SEPAY_WEBHOOK_SECRET=sepay_webhook_secret_****************
FRONTEND_URL=https://brewlite.vercel.app

# Cấu hình trên Vercel (Frontend Web):
NEXT_PUBLIC_API_URL=https://brewlite-api.onrender.com/api
NEXT_PUBLIC_APP_NAME=BrewLite
```

---

## 5. Bảng Truy vết từ Deployment Diagram đến Mã nguồn

Đáp ứng tiêu chí nghiệm thu Task 3.2: *Mỗi container/dịch vụ trong deployment diagram đều được ánh xạ rõ ràng đến thành phần kiến trúc và cấu trúc thư mục mã nguồn.*

| Thành phần trên Sơ đồ | Dịch vụ Cloud | Cấu hình & Mã nguồn tương ứng |
|---|---|---|
| **Next.js PWA Client** | Vercel Edge / CDN | Thư mục `apps/web`, cấu hình `apps/web/next.config.mjs` |
| **NestJS API Service** | Render Docker Container | Thư mục `apps/api`, `Dockerfile`, `apps/api/src/main.ts` |
| **Health Check Endpoint** | API Container Route | `apps/api/src/health/health.controller.ts` |
| **Database Connection & ORM** | Render Managed PostgreSQL | Schema `apps/api/prisma/schema.prisma`, `PrismaService` |
| **Payment & IPN Webhook** | SePay Sandbox Integration | `apps/api/src/payments/payments.service.ts` |
| **CI/CD Pipeline** | GitHub Actions | Kịch bản tự động hóa `.github/workflows/ci.yml`, `.github/workflows/cd.yml` |
| **Local Orchestration** | Local Docker Engine | Tệp điều phối `docker-compose.yml` |

---

## 6. Tự động hóa Giao vận & Triển khai Liên tục (CD Pipeline – Task 5.3)

Quy trình Continuous Delivery (CD) được thiết kế và điều phối bởi **Kiệt (Lead)** và **Hùng (DevOps)** thông qua GitHub Actions (`.github/workflows/cd.yml`), tự động kích hoạt mỗi khi có tag phiên bản mới (`v*.*.*`) hoặc mã nguồn được sáp nhập vào nhánh `main`.

### 6.1 Sơ đồ Chuỗi Pipeline Đầy đủ (End-to-End CD Stages)

```text
[Push / Tag]
     │
     ▼
[Stage 1: Quality Gate] ─── (Lint & Type-check + Unit Tests + Application Build)
     │
     ▼
[Stage 2 & 3: Docker Packaging] ─── (Multi-stage Build -> Tag SHA / SemVer -> Push GHCR)
     │
     ▼
[Stage 4: Safe DB Migration] ─── (Zero-downtime Prisma Migration: prisma migrate deploy)
     │
     ▼
[Stage 5: Production Deployment] ─── (Trigger Render PaaS API & Vercel Edge Web via Hooks)
     │
     ▼
[Stage 6: Post-Deploy Smoke Test] ─── (Curl GET /health & Verify Frontend HTTPS 200 OK)
     │
     ├── (Nếu thành công) ──> [Hoàn tất Triển khai & Cập nhật Release Notes]
     └── (Nếu thất bại)   ──> [Stage 7: Rollback Protocol Tức thì & Cảnh báo Sự cố]
```

### 6.2 Bảy Tiêu chí Vận hành Bắt buộc của Pipeline CD
1. **Quality Gate:** Tuyệt đối không cho phép đóng gói container nếu Unit Test hoặc Lint thất bại.
2. **Container Versioning:** Image được gắn nhãn kép: commit SHA rút gọn (`sha-xxxxxxx`) và phiên bản ngữ nghĩa (`v1.0.0`).
3. **Container Registry:** Image được lưu trữ bảo mật tại GitHub Packages (`ghcr.io/ngtuankiet241-cmd/assignment2--brewlite/api` và `web`).
4. **Bảo mật Secret:** Khóa API, Webhook token và Connection String được lưu trữ trong GitHub Repository Secrets (`RENDER_DEPLOY_HOOK_URL`, `PRODUCTION_DATABASE_URL`).
5. **Safe Migration:** Di chuyển cấu trúc dữ liệu (`prisma migrate deploy`) thực thi độc lập trước khi kích hoạt container mới để tránh xung đột schema.
6. **Smoke Testing tự động:** Tự động gửi request kiểm tra tính sống còn qua endpoint `/health` (tối đa 6 lần thử lại trong 60 giây).
7. **Rollback tự động:** Tự động dừng chuỗi thực thi và kích hoạt kịch bản khôi phục phiên bản trước khi Smoke test không đạt yêu cầu.

---

## 7. Danh mục Môi trường Vận hành Thực tế (Production Delivery – Task 5.4)

| Thành phần | Nền tảng Đám mây | Địa chỉ Truy cập (HTTPS) | Trạng thái Nghiệm thu |
|---|---|---|:---:|
| **Frontend PWA** | Vercel Global Edge CDN | [https://brewlite.vercel.app](https://brewlite.vercel.app) | 🟢 Đang hoạt động |
| **Backend REST API** | Render.com Web Service | [https://brewlite-api.onrender.com/api](https://brewlite-api.onrender.com/api) | 🟢 Đang hoạt động |
| **Giám sát Sức khỏe** | Render API Health Check | [https://brewlite-api.onrender.com/health](https://brewlite-api.onrender.com/health) | 🟢 Đang hoạt động (`status: ok`) |
| **Cơ sở Dữ liệu** | Render Managed PostgreSQL 16 | Kết nối mạng nội bộ riêng (Private Service Network) | 🟢 Đang hoạt động (ACID) |
| **Cổng Thanh toán** | SePay Sandbox Gateway | Giả lập quét mã QR và Webhook IPN thời gian thực | 🟢 Đang hoạt động |

---

## 8. Sổ tay Hướng dẫn Khôi phục Sự cố (Rollback Playbook)

Khi phát hiện sự cố nghiêm trọng sau triển khai (lỗi chức năng thanh toán, crash server hoặc latency vượt ngưỡng), đội ngũ áp dụng quy trình Rollback khẩn cấp theo các cấp độ:

### 8.1 Rollback Giao diện Frontend (Vercel Instant Rollback)
- **Thời gian khôi phục:** $< 30\text{ giây}$.
- **Thao tác:**
  1. Đăng nhập vào Vercel Dashboard $\rightarrow$ Dự án `brewlite`.
  2. Chọn tab **Deployments**, tìm bản deployment ổn định gần nhất có trạng thái *Ready*.
  3. Nhấp vào menu ba chấm ($\dots$) $\rightarrow$ Chọn **Instant Rollback**.
  4. Toàn bộ lưu lượng toàn cầu (Global Traffic) sẽ được chuyển hướng tức thì về bản build cũ mà không cần chờ build lại.

### 8.2 Rollback Backend API (Render Manual / Automated Rollback)
- **Thời gian khôi phục:** $1 - 2\text{ phút}$.
- **Thao tác qua GitHub Actions (Tự động):**
  - Khi Job `smoke-test` thất bại, Job `rollback-on-failure` tự động kích hoạt webhook gọi Render API để redeploy commit SHA ổn định trước đó.
- **Thao tác thủ công qua Dashboard:**
  1. Đăng nhập vào Render Dashboard $\rightarrow$ Web Service `brewlite-api`.
  2. Vào mục **Events** $\rightarrow$ Tìm commit hoạt động tốt gần nhất.
  3. Chọn **Roll back to this deploy**. Render sẽ khởi động lại container dựa trên Docker image cũ đã cache.

### 8.3 Rollback Cơ sở Dữ liệu (Prisma Migration Rollback)
- **Nguyên tắc an toàn:** Không chạy lệnh rollback trực tiếp trên database đang có kết nối sống nếu có nguy cơ mất mát dữ liệu giao dịch của khách hàng.
- **Quy trình xử lý:**
  1. Khóa tạm thời truy cập ghi của ứng dụng (chuyển sang chế độ bảo trì nếu cần).
  2. Tạo migration đảo ngược (Revert Migration) bằng mã SQL:
     ```bash
     cd apps/api
     npx prisma migrate diff --from-schema-datamodel prisma/schema.prisma --to-migrations prisma/migrations --script > rollback.sql
     ```
  3. Rà soát kỹ nội dung file `rollback.sql` (bảo đảm không có lệnh `DROP TABLE` nguy hiểm với các bảng `Order`, `Payment`, `User`).
  4. Thực thi file SQL khắc phục vào database:
     ```bash
     npx prisma db execute --file ./rollback.sql
     ```
  5. Đẩy commit sửa lỗi lên nhánh `main` để pipeline CD ghi nhận trạng thái schema chính xác.


