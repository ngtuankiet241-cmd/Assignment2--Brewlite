# 📖 Danh sách User Stories – Hệ thống BrewLite (Assignment 2)

Dự án áp dụng phương pháp phát triển phần mềm Agile/Scrum. Mỗi User Story (US) được viết theo cấu trúc chuẩn:  
> **Là một (As a)** `<vai trò>`  
> **Tôi muốn (I want)** `<hành động / tính năng>`  
> **Để (So that)** `<giá trị mang lại / mục tiêu>`  

Kèm theo các **Tiêu chí chấp nhận (Acceptance Criteria - AC)** định lượng cụ thể để làm căn cứ kiểm thử (Testing) và nghiệm thu (Definition of Done).

---

## ☕ Epic 1: Phân hệ Thực đơn & Tùy biến Sản phẩm (Menu & Product Customization)

### US-01: Khám phá thực đơn và lọc theo danh mục món (Ánh xạ: FR-01)
- **User Story:** Là **Khách hàng**, tôi muốn **xem danh sách các món đồ uống được phân chia rõ ràng theo từng danh mục (Cà phê, Trà sữa, Trà trái cây, Đá xay)**, để **tôi nhanh chóng tìm thấy món nước phù hợp với sở thích của mình**.
- **Tiêu chí chấp nhận (Acceptance Criteria):**
  - **AC1 (Hiển thị thẻ món):** Mỗi sản phẩm trên danh sách phải hiển thị đầy đủ: hình ảnh minh họa, tên sản phẩm, mô tả ngắn gọn và mức giá cơ sở (giá khởi điểm cho Size tiêu chuẩn).
  - **AC2 (Phản hồi lọc danh mục):** Khi người dùng nhấn vào các nút danh mục (Tabs), danh sách sản phẩm hiển thị đúng các món thuộc danh mục đó tức thì, không tải lại trang (SPA).
  - **AC3 (Trạng thái nạp dữ liệu):** Hiển thị hiệu ứng tải (Loading / Skeleton) mượt mà trong khi ứng dụng nạp dữ liệu từ Backend API `GET /products`.

### US-02: Xem chi tiết và tùy biến kích cỡ (Size) đồ uống (Ánh xạ: FR-02, FR-03)
- **User Story:** Là **Khách hàng**, tôi muốn **mở cửa sổ chi tiết (Modal) để chọn kích cỡ (Size S/M/L) cho ly nước**, để **cá nhân hóa đồ uống đúng với dung tích mong muốn và biết chính xác giá tiền tương ứng**.
- **Tiêu chí chấp nhận (Acceptance Criteria):**
  - **AC1 (Lựa chọn kích cỡ):**
    - Bắt buộc chọn duy nhất 1 loại kích cỡ tại một thời điểm (Single choice).
    - Mặc định hệ thống tự chọn Size tiêu chuẩn (Size M).
    - Giá tiền hiển thị tự động cộng/trừ chênh lệch tương ứng theo từng kích cỡ (ví dụ: Size S -5.000đ, Size L +5.000đ).

### US-03: Tùy biến Topping và tính toán giá động (Ánh xạ: FR-03, FR-04)
- **User Story:** Là **Khách hàng**, tôi muốn **thêm các loại topping cho ly nước và thấy tổng tiền cập nhật tự động**, để **ly nước thêm phần ngon miệng và kiểm soát được chi phí trước khi thêm vào giỏ**.
- **Tiêu chí chấp nhận (Acceptance Criteria):**
  - **AC1 (Tùy chọn Topping):**
    - Cho phép chọn cùng lúc nhiều loại topping khác nhau (Multiple choice: Trân châu, Thạch đào, Kem cheese...).
    - Cho phép tùy chỉnh số lượng từng loại topping, chặn hoàn toàn số lượng âm (số lượng $\ge 0$).
  - **AC2 (Công thức tính toán giá động):** Tổng tiền tạm tính ở chân Modal cập nhật thời gian thực theo công thức:
    $$\text{Tổng tiền} = \left( \text{Giá cơ sở} + \text{Phụ thu Size} + \sum \text{Giá Topping} \right) \times \text{Số lượng ly}$$
  - **AC3 (Thao tác giỏ hàng):** Khi nhấn nút "Thêm vào giỏ hàng", toàn bộ cấu hình đã chọn (Món, Size, Topping, Số lượng, Đơn giá tạm tính) được đóng gói vào trạng thái Giỏ hàng và tự động đóng Modal.

---

## 🛒 Epic 2: Quản lý Giỏ hàng (Cart Management)

### US-04: Thêm và theo dõi món trong giỏ (Ánh xạ: FR-04)
- **User Story:** Là **Khách hàng**, tôi muốn **thêm món đã cấu hình vào giỏ hàng và thấy huy hiệu (badge) giỏ hàng cập nhật**, để **tôi có thể chọn thêm các món khác trước khi thanh toán một lần**.
- **Tiêu chí chấp nhận:** Biểu tượng giỏ hàng trên thanh điều hướng cập nhật số lượng tức thì (+1) và lưu trạng thái vào LocalStorage/State.

### US-05: Cập nhật số lượng món trong giỏ (Ánh xạ: FR-05)
- **User Story:** Là **Khách hàng**, tôi muốn **tăng/giảm số lượng từng món ngay trong giỏ hàng**, để **tôi điều chỉnh lượng mua phù hợp với số người uống**.
- **Tiêu chí chấp nhận:** Bấm nút `+` hoặc `-` tại mỗi dòng; số lượng là số nguyên dương $\ge 1$; thành tiền và tổng tiền giỏ hàng tự động tính lại ngay lập tức.

### US-06: Xóa món khỏi giỏ hàng (Ánh xạ: FR-06)
- **User Story:** Là **Khách hàng**, tôi muốn **xóa một món không muốn mua nữa khỏi giỏ hàng**, để **tổng tiền thanh toán đúng với các món tôi thực sự muốn**.
- **Tiêu chí chấp nhận:** Món bị loại bỏ khỏi giỏ; tổng tiền giảm tương ứng. Nếu giỏ rỗng, hiển thị màn hình giỏ trống với nút điều hướng "Xem thực đơn".

---

## 📦 Epic 3: Đặt hàng & Xử lý Đơn (Order Placement & Processing)

### US-07: Xem lại đơn và nhập thông tin nhận món (Ánh xạ: FR-08, FR-09)
- **User Story:** Là **Khách hàng**, tôi muốn **kiểm tra lại danh sách món và điền tên/SĐT nhận hàng**, để **nhân viên quầy chuẩn bị đúng món và gọi đúng tên tôi khi nhận nước**.
- **Tiêu chí chấp nhận:** Giỏ hàng có ít nhất 01 món hợp lệ; form kiểm tra bắt buộc họ tên và SĐT đúng định dạng trước khi cho phép bấm nút thanh toán.

### US-08: Khởi tạo đơn hàng an toàn (Ánh xạ: FR-10)
- **User Story:** Là **Khách hàng**, tôi muốn **xác nhận đặt đơn để hệ thống lưu đơn vào database và trừ tạm tồn kho**, để **đơn hàng của tôi bắt đầu được chuẩn bị**.
- **Tiêu chí chấp nhận:** Backend NestJS thực hiện tạo bản ghi `Order` (trạng thái `PENDING`), snapshot toàn bộ tên món, size, topping, đơn giá vào `OrderItem` và trừ tồn kho trong một Database Transaction duy nhất.

### US-09: Theo dõi trạng thái đơn hàng (Ánh xạ: FR-11)
- **User Story:** Là **Khách hàng**, tôi muốn **theo dõi trạng thái pha chế của đơn theo thời gian thực**, để **tôi biết khi nào nước đã làm xong để ra quầy nhận**.
- **Tiêu chí chấp nhận:** Giao diện hiển thị thanh tiến trình trực quan: Chờ thanh toán -> Đã xác nhận -> Đang chuẩn bị -> Sẵn sàng nhận -> Hoàn thành.

### US-10: Cập nhật tiến độ pha chế (Ánh xạ: FR-12)
- **User Story:** Là **Nhân viên quầy**, tôi muốn **chuyển trạng thái đơn từ Đang pha chế sang Sẵn sàng nhận**, để **báo cho khách hàng biết đến quầy lấy nước**.
- **Tiêu chí chấp nhận:** Chỉ nhân viên có quyền mới được cập nhật; chuyển trạng thái tuân thủ nghiêm ngặt State Machine của hệ thống.

---

## 💳 Epic 4: Thanh toán Mô phỏng (Simulated Cashless Payment)

### US-11: Lựa chọn cổng thanh toán (Ánh xạ: FR-18)
- **User Story:** Là **Khách hàng**, tôi muốn **chọn phương thức thanh toán trực tuyến (Ví điện tử hoặc Thẻ ngân hàng)**, để **tôi không cần chuẩn bị tiền lẻ hoặc tiền mặt**.
- **Tiêu chí chấp nhận:** Hiển thị 2 phương thức (Ví/Thẻ); bắt buộc chọn 1 phương thức trước khi gửi yêu cầu thanh toán.

### US-12: Thanh toán và xác nhận tức thì (Ánh xạ: FR-19, FR-20, FR-21)
- **User Story:** Là **Khách hàng**, tôi muốn **xác nhận thanh toán mô phỏng sandbox**, để **đơn hàng được chuyển sang trạng thái Đã thanh toán (PAID) an toàn và không bị trừ tiền lặp lại**.
- **Tiêu chí chấp nhận:** Nhận kết quả thành công từ SePay Sandbox -> đơn chuyển `PAID`; sử dụng `Idempotency-Key` ngăn chặn hoàn toàn việc trừ tiền/tạo giao dịch kép khi người dùng click nhiều lần.

---

## 🔐 Epic 5: Tài khoản & Bảo mật (Authentication & Security)

### US-13: Đăng ký & Đăng nhập tài khoản (Ánh xạ: FR-14, FR-15, FR-16)
- **User Story:** Là **Khách hàng**, tôi muốn **đăng ký tài khoản và đăng nhập bằng Email/Password**, để **tôi có thể lưu lại lịch sử đặt nước và quản lý đơn của mình**.
- **Tiêu chí chấp nhận:** Mật khẩu được băm an toàn với bcrypt; hệ thống cấp JWT Token hợp lệ để bảo vệ các API yêu cầu xác thực.

### US-14: Xem lịch sử đơn hàng cá nhân (Ánh xạ: FR-13)
- **User Story:** Là **Khách hàng**, tôi muốn **xem lại danh sách các đơn hàng tôi từng đặt**, để **tôi dễ dàng xem lại hóa đơn hoặc đặt lại món cũ**.
- **Tiêu chí chấp nhận:** Khách hàng chỉ xem được các đơn hàng thuộc tài khoản của chính mình.
