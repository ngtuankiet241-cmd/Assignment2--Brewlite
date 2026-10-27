# 📖 Danh sách User Stories – Hệ thống BrewLite

Dự án áp dụng phương pháp phát triển phần mềm Agile/Scrum. Mỗi User Story (US) được viết theo cấu trúc chuẩn:  
> **Là một (As a)** `<vai trò>`  
> **Tôi muốn (I want)** `<hành động / tính năng>`  
> **Để (So that)** `<giá trị mang lại / mục tiêu>`  

---

## ☕ Epic 1: Quản lý Thực đơn & Sản phẩm (Menu & Product Browsing)

### US-01: Xem danh mục sản phẩm (Ánh xạ: FR-01)
- **User Story:** Là một **Khách hàng**, tôi muốn **xem danh sách các loại nước uống kèm hình ảnh và giá cả**, để **tôi có thể dễ dàng lựa chọn món đồ uống yêu thích**.
- **Tiêu chí chấp nhận (Acceptance Criteria):**
  - *Given:* Khách hàng truy cập vào trang chủ/menu của ứng dụng web.
  - *When:* Dữ liệu tải thành công từ API `GET /products`.
  - *Then:* Hiển thị danh sách món với tên, ảnh, giá bán và nhãn hết hàng (nếu tồn kho = 0).

### US-02: Xem chi tiết sản phẩm (Ánh xạ: FR-02)
- **User Story:** Là một **Khách hàng**, tôi muốn **bấm vào một món để xem mô tả chi tiết và các tùy chọn**, để **tôi biết rõ nguyên liệu và các tùy chỉnh trước khi mua**.
- **Tiêu chí chấp nhận:**
  - *Given:* Khách hàng đang ở màn hình menu.
  - *When:* Khách hàng nhấn vào thẻ của một sản phẩm bất kỳ.
  - *Then:* Hiển thị màn hình modal/chi tiết món gồm: mô tả sản phẩm, giá gốc, các kích cỡ (Size S/M/L) và danh sách topping khả dụng.

### US-03: Tùy chỉnh kích cỡ và topping (Ánh xạ: FR-03)
- **User Story:** Là một **Khách hàng**, tôi muốn **chọn size (S/M/L) và thêm topping (trân châu, thạch...)**, để **ly nước đúng khẩu vị của tôi**.
- **Tiêu chí chấp nhận:**
  - *Given:* Khách hàng đang ở màn hình chi tiết sản phẩm.
  - *When:* Khách hàng chọn size khác (ví dụ: Size L +5.000đ) hoặc tick chọn topping (+5.000đ/phần).
  - *Then:* Giá tạm tính của món được cộng dồn tức thì trên giao diện trước khi thêm vào giỏ.

---

## 🛒 Epic 2: Quản lý Giỏ hàng (Cart Management)

### US-04: Thêm món vào giỏ hàng (Ánh xạ: FR-04)
- **User Story:** Là một **Khách hàng**, tôi muốn **thêm món đã chọn cùng các tùy biến vào giỏ hàng**, để **tôi có thể chọn thêm các món khác trước khi thanh toán một lần**.
- **Tiêu chí chấp nhận:**
  - *When:* Khách hàng bấm nút "Thêm vào giỏ hàng".
  - *Then:* Biểu tượng giỏ hàng cập nhật số lượng badge (+1) và lưu trạng thái vào LocalStorage/State.

### US-05: Cập nhật số lượng món trong giỏ (Ánh xạ: FR-05)
- **User Story:** Là một **Khách hàng**, tôi muốn **tăng/giảm số lượng từng món ngay trong giỏ hàng**, để **tôi điều chỉnh lượng mua phù hợp với số người uống**.
- **Tiêu chí chấp nhận:**
  - *When:* Bấm nút `+` hoặc `-` tại một dòng sản phẩm trong giỏ.
  - *Then:* Số lượng cập nhật (tối thiểu là 1), thành tiền của dòng và tổng tiền giỏ hàng tự động tính lại ngay lập tức.

### US-06: Xóa món khỏi giỏ hàng (Ánh xạ: FR-06)
- **User Story:** Là một **Khách hàng**, tôi muốn **xóa một món không muốn mua nữa khỏi giỏ hàng**, để **tổng tiền thanh toán đúng với các món tôi thực sự muốn**.
- **Tiêu chí chấp nhận:**
  - *When:* Bấm nút "Xóa" hoặc icon thùng rác bên cạnh món.
  - *Then:* Món bị loại bỏ khỏi giỏ, tổng tiền giảm tương ứng. Nếu giỏ rỗng, hiển thị màn hình giỏ trống với nút "Xem thực đơn".

---

## 📦 Epic 3: Đặt hàng & Xử lý Đơn (Order Placement & Processing)

### US-07: Xem lại đơn và nhập thông tin (Ánh xạ: FR-08, FR-09)
- **User Story:** Là một **Khách hàng**, tôi muốn **kiểm tra lại danh sách món và điền tên/SĐT nhận hàng**, để **nhân viên quầy chuẩn bị đúng món và gọi đúng tên tôi khi nhận nước**.
- **Tiêu chí chấp nhận:**
  - *Given:* Giỏ hàng có ít nhất 01 sản phẩm hợp lệ.
  - *When:* Bấm "Tiến hành đặt hàng".
  - *Then:* Hiển thị tóm tắt đơn (tổng tiền, danh sách món) và form nhập họ tên, SĐT bắt buộc.

### US-08: Khởi tạo đơn hàng (Ánh xạ: FR-10)
- **User Story:** Là một **Khách hàng**, tôi muốn **xác nhận đặt đơn để hệ thống lưu đơn vào database và giữ hàng**, để **đơn hàng của tôi bắt đầu được chuẩn bị**.
- **Tiêu chí chấp nhận:**
  - *When:* Khách hàng bấm "Xác nhận đặt hàng".
  - *Then:* Backend NestJS tạo bản ghi `Order` với trạng thái `PENDING`, snapshot toàn bộ đơn giá, trừ tạm thời số lượng tồn kho `stock` trong một Transaction duy nhất.

### US-09: Theo dõi trạng thái đơn hàng (Ánh xạ: FR-11)
- **User Story:** Là một **Khách hàng**, tôi muốn **theo dõi trạng thái pha chế của đơn theo thời gian thực**, để **tôi biết khi nào nước đã làm xong để ra quầy nhận**.
- **Tiêu chí chấp nhận:**
  - *Then:* Giao diện hiển thị thanh tiến trình trực quan: Chờ thanh toán -> Đã xác nhận -> Đang chuẩn bị -> Sẵn sàng nhận -> Hoàn thành.

### US-10: Cập nhật tiến độ pha chế (Ánh xạ: FR-12)
- **User Story:** Là một **Nhân viên quầy**, tôi muốn **chuyển trạng thái đơn từ Đang làm sang Đã xong**, để **báo cho khách hàng biết đến quầy lấy nước**.
- **Tiêu chí chấp nhận:**
  - *Given:* Nhân viên có quyền truy cập màn hình quản lý đơn.
  - *When:* Bấm "Đã pha chế xong".
  - *Then:* Đơn hàng chuyển sang trạng thái `READY`, đồng bộ tức thì cho khách hàng.

---

## 💳 Epic 4: Thanh toán Mô phỏng (Simulated Cashless Payment)

### US-11: Lựa chọn cổng thanh toán (Ánh xạ: FR-18)
- **User Story:** Là một **Khách hàng**, tôi muốn **chọn phương thức thanh toán trực tuyến (Ví điện tử hoặc Thẻ ngân hàng)**, để **tôi không cần chuẩn bị tiền lẻ hoặc tiền mặt**.
- **Tiêu chí chấp nhận:**
  - *Then:* Hiển thị hai tùy chọn thanh toán mô phỏng (Ví/Thẻ). Khách hàng bắt buộc phải chọn 1 phương thức trước khi thanh toán.

### US-12: Thanh toán và xác nhận tức thì (Ánh xạ: FR-19, FR-20, FR-21)
- **User Story:** Là một **Khách hàng**, tôi muốn **quét mã QR hoặc xác nhận thanh toán sandbox**, để **đơn hàng được chuyển sang trạng thái Đã thanh toán (PAID) an toàn và không bị trừ tiền lặp lại**.
- **Tiêu chí chấp nhận:**
  - *When:* Cổng SePay sandbox gửi Webhook/IPN xác nhận thành công.
  - *Then:* Đơn hàng chuyển trạng thái sang `PAID`, giao diện khách hàng hiển thị thông báo "Thanh toán thành công", ngăn chặn thanh toán lại lần 2 bằng `Idempotency-Key`.

---

## 🔐 Epic 5: Tài khoản & Bảo mật (Authentication & Security)

### US-13: Đăng ký & Đăng nhập tài khoản (Ánh xạ: FR-14, FR-15, FR-16)
- **User Story:** Là một **Khách hàng**, tôi muốn **đăng ký tài khoản và đăng nhập bằng Email/Password**, để **tôi có thể lưu lại lịch sử đặt nước và quản lý đơn của mình**.
- **Tiêu chí chấp nhận:**
  - Mật khẩu băm an toàn với bcrypt. Sau khi đăng nhập thành công, hệ thống lưu JWT Token để xác thực các thao tác tạo đơn.

### US-14: Xem lịch sử đơn hàng cá nhân (Ánh xạ: FR-13)
- **User Story:** Là một **Khách hàng**, tôi muốn **xem lại danh sách các đơn hàng tôi từng đặt**, để **tôi dễ dàng xem lại hóa đơn hoặc đặt lại món cũ**.
- **Tiêu chí chấp nhận:**
  - Chỉ hiển thị các đơn hàng thuộc ID tài khoản của người dùng đang đăng nhập.
