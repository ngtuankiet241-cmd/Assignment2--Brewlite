# 🎬 Kịch bản Video Demo Trực tiếp Luồng End-to-End – BrewLite

> **Dự án:** BrewLite – Ứng dụng Đặt Thức uống Không Dùng Tiền Mặt  
> **Môn học:** Công nghệ Phần mềm – GVHD: ThS. Từ Lãng Phiêu  
> **Người biên soạn & Thực hiện chính:** Kiệt (Nhóm trưởng)  
> **Thời lượng dự kiến:** 5 phút 30 giây  
> **Chất lượng video:** 1080p Full HD / 60 FPS, âm thanh rõ ràng, có phụ đề/ghi chú trực quan  

---

## 📋 Bảng Phân cảnh Chi tiết (Storyboard & Timeline)

| Phân cảnh | Thời lượng | Nội dung hình ảnh / Thao tác trên màn hình | Lời thoại thuyết minh (Voiceover Script) | Người phụ trách |
|:---:|:---:|---|---|:---:|
| **Scene 1: Giới thiệu** | 00:00 - 00:45 | - Hiển thị Slide tiêu đề: Tên đề tài BrewLite, Logo Trường Đại học Sài Gòn & Khoa CNTT.<br>- Danh sách 6 thành viên nhóm cùng MSSV và vai trò.<br>- Trình chiếu kiến trúc tổng thể (Next.js PWA + NestJS + PostgreSQL + SePay). | "Xin chào Thầy và các bạn, em là Kiệt, đại diện nhóm sinh viên thực hiện đề tài BrewLite trong môn Công nghệ Phần mềm do Thầy Từ Lãng Phiêu hướng dẫn. Hệ thống BrewLite là nền tảng đặt thức uống không tiền mặt dành cho quán cà phê hiện đại, được xây dựng theo kiến trúc phân tầng chuẩn mực với Next.js 14, NestJS 10, PostgreSQL 16 và cổng thanh toán mô phỏng SePay. Hôm nay, em xin phép trình bày bản demo thực tế luồng hoạt động End-to-End của hệ thống trên môi trường Production." | Kiệt |
| **Scene 2: Khám phá Menu & Tùy biến món** | 00:45 - 01:45 | - Mở trình duyệt tại URL Production: `https://assignment2-brewlite.vercel.app`.<br>- Bật chế độ Responsive Mobile (DevTools).<br>- Thao tác lướt danh mục thức uống (Cà phê, Trà sữa, Trà trái cây).<br>- Nhấp vào món "Trà sữa Ô long nướng".<br>- Modal tùy chỉnh xuất hiện: Chọn Size L (+10.000đ), 50% Đường, 70% Đá, chọn thêm Topping Trân châu trắng (+8.000đ).<br>- Giá tạm tính tự động cập nhật mượt mà theo thời gian thực.<br>- Nhấn "Thêm vào giỏ hàng". | "Đầu tiên, khách hàng truy cập ứng dụng BrewLite qua điện thoại di động với giao diện Web Mobile-first được tối ưu mượt mà. Khách hàng dễ dàng tìm kiếm thức uống yêu thích và lựa chọn từng thông số chi tiết như kích cỡ Size M hoặc L, tùy chỉnh lượng đường đá, và thêm các loại topping hấp dẫn. Mọi sự thay đổi về đơn giá đều được tính toán và phản hồi tức thì trên giao diện trước khi đưa vào giỏ hàng." | Kiệt & Luân |
| **Scene 3: Quản lý Giỏ hàng & Đặt hàng** | 01:45 - 02:45 | - Mở Drawer Giỏ hàng.<br>- Tăng số lượng món lên 2 ly, xóa thử 1 món phụ để chứng minh tính năng cập nhật.<br>- Tổng tiền hiển thị chính xác.<br>- Nhấn "Tiến hành Đặt hàng".<br>- Chuyển sang màn hình Checkout: Nhập thông tin người nhận (Họ tên: Nguyễn Tuấn Kiệt, SĐT: 0901234567, Bàn số 04, Ghi chú: 'Ít ngọt').<br>- Chọn phương thức thanh toán: 'Chuyển khoản SePay QR / Thẻ'.<br>- Nhấn "Xác nhận đặt hàng". | "Tại màn hình giỏ hàng, khách hàng có thể kiểm tra kỹ danh sách món, điều chỉnh số lượng hoặc loại bỏ sản phẩm nếu muốn. Khi tiến hành đặt hàng, khách hàng điền các thông tin phục vụ như số bàn và ghi chú cho quầy pha chế. Sau đó, hệ thống gửi yêu cầu đặt hàng an toàn lên Backend NestJS với cơ chế bảo vệ giao dịch ACID, trừ số lượng kho và khởi tạo mã đơn hàng duy nhất." | Kiệt & Luân |
| **Scene 4: Thanh toán SePay Sandbox & Webhook IPN** | 02:45 - 03:45 | - Màn hình hiển thị mã QR thanh toán SePay Sandbox đi kèm mã đơn hàng và số tiền chính xác.<br>- Giả lập thanh toán thành công trên cổng SePay Sandbox.<br>- Hệ thống nhận Webhook IPN theo thời gian thực.<br>- Giao diện tự động chuyển sang trang "Đặt hàng Thành công!" với trạng thái chuyển từ `PENDING` sang `PAID` và hiển thị mã đơn hàng. | "Tại bước thanh toán, BrewLite tích hợp cổng thanh toán mô phỏng SePay Sandbox. Khách hàng có thể quét mã QR thanh toán ngân hàng với số tiền và nội dung chuyển khoản được cấu hình tự động. Ngay khi giao dịch hoàn tất, cổng SePay sẽ kích hoạt Webhook IPN an toàn có đối soát chữ ký số gửi về Backend NestJS. Nhờ cơ chế Idempotency Key, hệ thống bảo đảm đơn hàng không bao giờ bị thanh toán trùng lặp dù người dùng có thao tác lặp lại." | Kiệt & Hùng |
| **Scene 5: Theo dõi Đơn & Kiểm tra Backend Health** | 03:45 - 04:30 | - Truy cập màn hình "Lịch sử & Theo dõi trạng thái đơn".<br>- Xem dòng thời gian trạng thái đơn hàng: Đã thanh toán -> Đang pha chế -> Sẵn sàng nhận.<br>- Chuyển sang tab mới, kiểm tra endpoint Health Check: `https://brewlite-assignment2-api.onrender.com/health`.<br>- Kết quả trả về JSON: `{"status":"ok","database":"connected","latency":"14ms"}`. | "Khách hàng có thể chủ động theo dõi tiến trình pha chế thức uống của mình qua trang trạng thái đơn hàng. Đồng thời, về mặt kỹ thuật, hệ thống cung cấp endpoint giám sát sức khỏe GET /health liên tục kiểm tra kết nối cơ sở dữ liệu PostgreSQL với độ trễ phản hồi chỉ dưới 20 miligiây, bảo đảm dịch vụ luôn hoạt động ổn định và sẵn sàng phục vụ." | Kiệt & Hùng |
| **Scene 6: Minh chứng Tự động hóa CI/CD & Kết luận** | 04:30 - 05:30 | - Mở giao diện GitHub Actions của repository `Assignment2--Brewlite`.<br>- Chỉ rõ các Pipeline CI/CD đã chạy thành công qua các bước: Quality Gate (Lint, Test, Build) -> Đóng gói Docker Images -> Push Registry -> Deploy Production -> Smoke Test.<br>- Trình chiếu Slide Sprint Retrospective tóm tắt bài học kinh nghiệm và lời cảm ơn. | "Cuối cùng, toàn bộ quá trình phát triển và bàn giao của nhóm đều được tự động hóa tuyệt đối thông qua GitHub Actions CI/CD Pipeline với đầy đủ các cổng kiểm định chất lượng, đóng gói Docker container và triển khai không gián đoạn lên nền tảng đám mây Render và Vercel. Thay mặt nhóm thực hiện đề tài BrewLite, em xin chân thành cảm ơn Thầy Từ Lãng Phiêu đã đồng hành và hướng dẫn chúng em hoàn thành xuất sắc đồ án này!" | Kiệt |

---

## 🛠️ Chuẩn bị Tiên quyết Trước khi Bấm Quay Video

1. **Kiểm tra Môi trường Production:**
   - Đảm bảo Backend Render đã "ấm" (không bị cold-sleep): Mở trước `https://brewlite-assignment2-api.onrender.com/health` để xác nhận HTTP 200.
   - Đảm bảo Frontend Vercel `https://assignment2-brewlite.vercel.app` tải bình thường, ảnh sản phẩm load đầy đủ.
2. **Dữ liệu Demo Sạch sẽ:**
   - Database đã được seed đầy đủ 6 sản phẩm mẫu.
   - Chuẩn bị sẵn thông tin test thẻ / mã QR sandbox của SePay.
3. **Phần mềm Ghi hình & Công cụ:**
   - OBS Studio hoặc phần mềm quay màn hình ở độ phân giải 1920x1080.
   - Microphone có lọc tiếng ồn (Noise suppression).
   - Mở sẵn 3 tab trình duyệt: (1) Ứng dụng BrewLite Production, (2) Health Check Endpoint, (3) GitHub Actions Runs.

