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
JWT_SECRET=<chuoi-ngau-nhien-toi-thieu-32-ky-tu>
JWT_EXPIRES_IN=1d
SEPAY_API_KEY=sepay_live_api_key_sandbox_****************
SEPAY_WEBHOOK_SECRET=sepay_webhook_secret_****************
FRONTEND_URL=https://assignment2-brewlite.vercel.app

# Cấu hình trên Vercel (Frontend Web):
NEXT_PUBLIC_API_URL=https://brewlite-assignment2-api.onrender.com
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

Quy trình CD trong `.github/workflows/cd.yml` chạy khi push vào `main` hoặc kích hoạt thủ công trên `main`. Không có chế độ staging hoặc deploy từ tag. Cấu hình bên dưới phải được hoàn tất trước khi bật pipeline này.

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
[Stage 4: Configuration & Migration] ─── (Kiểm tra secrets -> prisma migrate deploy)
     │
     ▼
[Stage 5: Production Deployment] ─── (Render -> Vercel: deploy đúng commit, chờ trạng thái)
     │
     ▼
[Stage 6: Smoke Test] ─── (Kiểm tra health, sản phẩm và frontend)
```

### 6.2 Cấu hình trước khi sử dụng

1. Trên Render, mở **Web Service API → Settings**, tắt auto-deploy theo Git. Ghi lại **service ID `srv-...`** của API; ID database `dpg-...` không phải service ID.
2. Trên Vercel, bảo đảm Project Root Directory là `apps/web` để đọc `apps/web/vercel.json`. File này tắt auto-deploy của nhánh `main` nhưng không tắt preview của các nhánh khác. Kiểm tra cấu hình thực tế trước khi dùng pipeline.
3. Trong GitHub **Settings → Secrets and variables → Actions**, tạo repository secrets:
   - `PRODUCTION_DATABASE_URL`: External Database URL của đúng database production; runner GitHub phải có quyền kết nối.
   - `RENDER_API_TOKEN`, `RENDER_SERVICE_ID`: token có quyền deploy và ID Web Service Render.
   - `VERCEL_TOKEN`, `VERCEL_PROJECT_ID`: token có quyền deploy và ID project Vercel.
   - `VERCEL_TEAM_ID`: ID team sở hữu project, nếu project thuộc team; bỏ trống nếu thuộc tài khoản cá nhân.
4. Trong cùng trang, tab **Variables**, tạo `VERCEL_PROJECT_NAME` bằng tên chính xác của project Vercel.
5. Không đưa token, database URL hay backup vào Git hoặc chat. Xác nhận các cấu hình, deploy test và theo dõi cả hai dashboard trước khi coi quy trình là hoạt động.

Pipeline dừng nếu thiếu secret hoặc migration thất bại. Nó yêu cầu Render triển khai commit của run và đợi `live`; sau đó yêu cầu Vercel triển khai cùng commit, đợi `READY` và xác nhận domain production. Nếu API trả lỗi, thiếu thông tin hoặc hết thời gian chờ, pipeline thất bại; kiểm tra dashboard trước khi thử lại để tránh deploy trùng.

**Giới hạn:** Việc tắt auto-deploy trực tiếp là điều kiện bắt buộc để tránh triển khai vượt qua migration. Migration có thể khóa bảng hoặc không tương thích với phiên bản API đang chạy; không đảm bảo zero-downtime. Cần sao lưu, thử migration và chỉ dùng thay đổi schema tương thích trước/sau. Pipeline không tự sao lưu hoặc rollback; nếu Vercel lỗi sau khi Render đã lên, production có thể ở trạng thái phiên bản hỗn hợp. Docker images được đẩy lên GHCR nhưng API deploy ở đây sử dụng commit Git theo cấu hình của Render/Vercel, không chứng minh các nền tảng chạy image GHCR đó.

---

## 7. Danh mục Môi trường Vận hành Thực tế (Production Delivery – Task 5.4)

| Thành phần | Nền tảng Đám mây | Địa chỉ Truy cập (HTTPS) | Trạng thái Nghiệm thu |
|---|---|---|:---:|
| **Frontend PWA** | Vercel Global Edge CDN | [https://assignment2-brewlite.vercel.app](https://assignment2-brewlite.vercel.app) | 🟢 Đang hoạt động |
| **Backend REST API** | Render.com Web Service | [https://brewlite-assignment2-api.onrender.com](https://brewlite-assignment2-api.onrender.com) | 🟢 Đang hoạt động |
| **Giám sát Sức khỏe** | Render API Health Check | [https://brewlite-assignment2-api.onrender.com/health](https://brewlite-assignment2-api.onrender.com/health) | 🟢 Đang hoạt động (`status: ok`) |
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

### 8.2 Rollback Backend API (Render Manual)
- **Thời gian khôi phục:** $1 - 2\text{ phút}$.
- Pipeline không tự động rollback. Khi deploy hoặc smoke test thất bại, kiểm tra trạng thái thực tế trên cả hai dashboard trước khi quyết định khôi phục.
- **Thao tác thủ công qua Dashboard:**
  1. Đăng nhập vào Render Dashboard $\rightarrow$ Web Service `brewlite-api`.
  2. Vào mục **Events** $\rightarrow$ Tìm commit hoạt động tốt gần nhất.
  3. Chọn **Roll back to this deploy**. Render sẽ khởi động lại container dựa trên Docker image cũ đã cache.

### 8.3 Rollback Cơ sở Dữ liệu (Prisma Migration Rollback)
- **Nguyên tắc an toàn:** Không chạy lệnh rollback trực tiếp trên database đang có kết nối sống nếu có nguy cơ mất mát dữ liệu giao dịch của khách hàng.
- **Quy trình xử lý:** Tạm ngưng ghi, sao lưu trạng thái hiện tại và đánh giá dữ liệu phát sinh sau bản backup. Thử khôi phục bản backup vào database riêng hoặc chuẩn bị migration khắc phục phù hợp; rà soát và thử nghiệm trước khi áp dụng production. Không dùng `migrate reset` hoặc chạy SQL đảo ngược chưa kiểm chứng trên production.


