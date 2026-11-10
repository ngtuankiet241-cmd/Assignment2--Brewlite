# ☕ BrewLite – Cashless Drink Ordering Application

> **Môn học:** Công nghệ Phần mềm (Software Engineering) – Học kỳ I, Năm học 2026–2027  
> **Giảng viên hướng dẫn:** ThS. Từ Lãng Phiêu  
> **Bài tập lớn:** Assignment 2 – Requirements to Deployment (Ver 1.0)  

---

## 👥 Danh sách Thành viên Nhóm

| STT | Họ và Tên | MSSV | Vai trò | Trách nhiệm chính |
|:---:|---|:---:|:---:|---|
| 1 | **Kiệt** | 3124410175 | **Trưởng nhóm** | Bối cảnh, Stakeholder, Scope, Rủi ro, Quản lý Repo & Báo cáo |
| 2 | **Luân** | 3124410204 | Thành viên | SRS Sản phẩm, Giỏ hàng, Đơn hàng, Frontend Next.js |
| 3 | **Hùng** | 3124410107 | Thành viên | SRS Xác thực, Thanh toán, Bảo mật, Backend NestJS |
| 4 | **Triệu** | 3124410376 | Thành viên | Sơ đồ Use-case tổng quát, Sequence Diagram |
| 5 | **Lượng** | 3124410207 | Thành viên | Đặc tả Use-case trọng tâm UC-01, Sequence Diagram |
| 6 | **Kha** | 3124410136 | Thành viên | Rà soát chất lượng SRS, Yêu cầu Dữ liệu, Activity Diagram |

---

## 🚀 Tổng quan Dự án

**BrewLite** là ứng dụng đặt thức uống không tiền mặt dành cho các quán cà phê / trà sữa vừa và nhỏ. Hệ thống cho phép khách hàng chủ động xem menu, tùy chọn món (size, topping), tạo đơn hàng và thanh toán trực tuyến qua điện thoại di động (PWA).

### 🛠 Ngăn xếp Công nghệ (Tech Stack)
- **Frontend:** Next.js 14+ (React, TypeScript, Tailwind CSS, Mobile-first / PWA).
- **Backend:** NestJS (TypeScript, RESTful API, Prisma ORM).
- **Cơ sở dữ liệu:** PostgreSQL 16.
- **Thanh toán:** Cổng thanh toán mô phỏng (SePay Sandbox).
- **Đóng gói & Triển khai:** Docker, Docker Compose, GitHub Actions (CI/CD).

---

## 📁 Cấu trúc Repository (Monorepo)

Hệ thống được tổ chức theo đúng quy chuẩn kiến trúc của đề bài:

```text
Assignment2--Brewlite/
├── apps/
│   ├── web/                     # Ứng dụng Frontend Next.js (Mobile-first/PWA)
│   └── api/                     # Ứng dụng Backend NestJS (REST API)
├── docs/                        # Toàn bộ tài liệu kỹ thuật có kiểm soát phiên bản
│   ├── requirements/            # [Task 1] SRS, bối cảnh, stakeholder, phạm vi
│   │   ├── context-and-scope.md
│   │   └── srs.md
│   ├── diagrams/                # [Task 2] Activity, Sequence, Class diagrams
│   ├── architecture/            # [Task 3] Kiến trúc phân tầng, deployment diagram
│   │   └── adr/                 # Architecture Decision Records
│   ├── traceability-matrix.md   # [Mục 8] Ma trận truy vết yêu cầu 5 cột
│   ├── deployment.md            # [Task 3.2 & 5.3] Hướng dẫn triển khai Production & Rollback
│   ├── demo-script.md           # [Task 5.4] Kịch bản video demo luồng End-to-End
│   ├── release-notes-v1.0.0.md  # [Task 5.4] Bản mô tả phát hành Production v1.0.0
│   └── report/                  # Báo cáo kỹ thuật tổng hợp (main.tex / PDF)
├── tests/                       # Bộ kiểm thử tích hợp và E2E
├── .github/
│   └── workflows/               # [Task 4.4 & 5.3] GitHub Actions CI/CD Pipeline
│       ├── ci.yml               # Pipeline Continuous Integration
│       └── cd.yml               # Pipeline Continuous Delivery & Rollback
├── docker-compose.yml           # [Task 5.2] Điều phối chạy cục bộ (postgres, api, web)
├── .env.example                 # Mẫu biến môi trường (không chứa secret)
├── .gitignore                   # Quy tắc bỏ qua file rác, secrets, build artifacts
└── README.md                    # Tài liệu hướng dẫn chính của dự án
```

---

## 🌿 Chiến lược Phân nhánh & Quy trình Làm việc (Branching Strategy)

Nhóm áp dụng mô hình **Git Feature Branching**:
- **`main`:** Nhánh chính thức, chỉ chứa mã nguồn ổn định đã kiểm thử và sẵn sàng triển khai.
- **`develop`:** Nhánh tích hợp cho từng Sprint.
- **`feature/<ten-tinh-nang>`:** Nhánh phát triển tính năng riêng của từng thành viên (ví dụ: `feature/menu-api`, `feature/cart-ui`).
- **`fix/<ten-loi>`:** Nhánh sửa lỗi phát sinh.

### 📜 Quy ước Pull Request (PR)
1. **Tuyệt đối không commit trực tiếp lên `main`**.
2. Mọi thay đổi đều phải tạo Pull Request vào `develop` hoặc `main`.
3. PR phải mô tả rõ mục đích, mã yêu cầu liên quan (ví dụ: `FR-01`), và bằng chứng đã kiểm thử (screenshots / test logs).
4. **Quality Gate:** Pipeline CI phải pass 100% (Lint, Test, Build) mới được phép Merge.

### 📝 Quy ước Đặt tên Commit (Conventional Commits)
Định dạng: `<loại>(<phạm vi>): <mô tả ngắn gọn bằng tiếng Anh hoặc tiếng Việt>`
- `feat`: Tính năng mới (ví dụ: `feat(menu): add GET /products API`)
- `fix`: Sửa lỗi (ví dụ: `fix(cart): correct total price calculation`)
- `docs`: Cập nhật tài liệu (ví dụ: `docs(srs): add acceptance criteria for FR-18`)
- `test`: Viết thêm hoặc sửa kiểm thử (ví dụ: `test(auth): add unit test for jwt guard`)
- `refactor`: Tái cấu trúc mã nguồn (ví dụ: `refactor(orders): optimize prisma transaction`)
- `chore`: Cập nhật cấu hình, dependency (ví dụ: `chore(docker): update compose config`)

---

## ✅ Tiêu chuẩn Hoàn thành (Definition of Done - DoD)

Một Task hoặc Pull Request chỉ được coi là hoàn thành (Done) khi thỏa mãn:
1. [ ] Mã nguồn tuân thủ coding standards và quy tắc linter (Oxlint / ESLint).
2. [ ] Các Unit Test liên quan chạy thành công và không làm vỡ các test cũ.
3. [ ] Code đã được review và phê duyệt bởi ít nhất 01 thành viên khác.
4. [ ] Pipeline CI của GitHub Actions chạy thành công (màu xanh).
5. [ ] Tài liệu kỹ thuật hoặc ma trận truy vết liên quan đã được cập nhật tương ứng.

---

## 💻 Hướng dẫn Cài đặt & Chạy Local

### 1. Yêu cầu Tiên quyết
- Node.js LTS (v18+) và npm / pnpm.
- Docker Desktop (để chạy PostgreSQL cục bộ).
- Git.

### 2. Thiết lập Biến Môi trường
Sao chép mẫu cấu hình môi trường:
```bash
cp .env.example .env
```
Chỉnh sửa `DATABASE_URL` và `JWT_SECRET` trong tệp `.env` cho phù hợp với máy của bạn.

### 3. Khởi chạy Dịch vụ Cục bộ

#### Bước 3.1: Khởi động Cơ sở dữ liệu PostgreSQL
```bash
docker compose up -d
```
Cơ sở dữ liệu PostgreSQL 16 sẽ sẵn sàng tại cổng `5432`.

#### Bước 3.2: Cài đặt và Chạy Backend NestJS (apps/api)
```bash
cd apps/api
npm install
npm run prisma:generate
npm run prisma:seed
npm run start:dev
```
- **Backend NestJS API:** `http://localhost:3001`
- **Health Check Endpoint:** `http://localhost:3001/health`
- **Chạy Unit Tests:** `npm test`
- **Chạy E2E Tests:** `npm run test:e2e`

#### Bước 3.3: Cài đặt và Chạy Frontend Next.js (apps/web)
Mở một terminal mới:
```bash
cd apps/web
npm install
npm run dev
```
- **Frontend Next.js:** `http://localhost:3000`
- **Màn hình Thực đơn:** `http://localhost:3000/menu`
- **Chạy Tests:** `npm test`

#### Cách 3.4: Khởi chạy Trọn gói Toàn bộ Dịch vụ qua Docker Compose (Task 5.2)
Chỉ với một câu lệnh duy nhất để chạy đồng thời cả Database, Backend API và Frontend Web trên Docker:
```bash
docker compose up -d --build
```
- **Web Frontend:** `http://localhost:3000`
- **Backend API:** `http://localhost:3001/api`
- **Health Check Endpoint:** `http://localhost:3001/health`
- **PostgreSQL:** `localhost:5432`

---

## 🌐 Môi trường Triển khai Production & Giám sát (Task 5.4)

Hệ thống BrewLite được triển khai chính thức trên nền tảng đám mây an toàn, hỗ trợ HTTPS:

| Dịch vụ | Nền tảng Đám mây | Địa chỉ Truy cập Thực tế (HTTPS) | Trạng thái |
|---|---|---|:---:|
| **Frontend PWA** | Vercel Global Edge CDN | [https://brewlite.vercel.app](https://brewlite.vercel.app) | 🟢 Live |
| **Backend API** | Render.com PaaS Container | [https://brewlite-api.onrender.com/api](https://brewlite-api.onrender.com/api) | 🟢 Live |
| **Health Check** | Render API Service | [https://brewlite-api.onrender.com/health](https://brewlite-api.onrender.com/health) | 🟢 Live (`HTTP 200`) |
| **PostgreSQL** | Render Managed PostgreSQL 16 | Kết nối nội bộ bảo mật (Private Network) | 🟢 Live |
| **Payment Gateway** | SePay Sandbox Gateway | Giả lập quét mã QR và Webhook IPN | 🟢 Live |

---

## 🔄 Tự động hóa CI/CD & Cơ chế Khôi phục (Rollback)

- **Continuous Integration (CI):** `.github/workflows/ci.yml` (Quality Gate 4 bước: Install $\rightarrow$ Lint $\rightarrow$ Unit Test $\rightarrow$ Build).
- **Continuous Delivery (CD):** `.github/workflows/cd.yml` (Chuỗi 7 bước: Push/Tag $\rightarrow$ Lint \& Test $\rightarrow$ Build $\rightarrow$ Docker Image $\rightarrow$ Push GHCR $\rightarrow$ Safe Migration \& Deploy $\rightarrow$ Post-deploy Smoke Test $\rightarrow$ Rollback on Failure).
- **Quy trình Rollback Khẩn cấp:** Xem chi tiết tại [docs/deployment.md#8-sổ-tay-hướng-dẫn-khôi-phục-sự-cố-rollback-playbook](docs/deployment.md).
- **Kịch bản Video Demo E2E:** Xem chi tiết kịch bản thuyết minh tại [docs/demo-script.md](docs/demo-script.md).
- **Bản phát hành Release Notes v1.0.0:** Xem chi tiết tại [docs/release-notes-v1.0.0.md](docs/release-notes-v1.0.0.md).

