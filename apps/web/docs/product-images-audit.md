# Đồng bộ ảnh sản phẩm — 15/11/2026

## 1. Nguồn dữ liệu và nguyên nhân

Đã đọc API production `https://assignment2-brewlite.vercel.app/api/products`
(HTTP 200): hiện có sáu sản phẩm, không có Cà phê đen, Americano, Bạc xỉu
hoặc Cappuccino trong kết quả.

Luồng nguồn ảnh: PostgreSQL `Product.imageUrl` → Prisma `findMany` → backend
`/products` → frontend `/api/products` → `useProducts` → thẻ và cửa sổ chi tiết.
Giỏ hàng sao chép `imageUrl` vào localStorage `brewlite-cart-v1`; vì vậy giỏ cũ
có thể tiếp tục giữ URL hỏng sau khi sửa menu.

Đã kiểm tra lại sáu URL bằng HTTP GET theo redirect:

| Sản phẩm | URL Unsplash được thay ở frontend | HTTP nguồn cũ | Đường dẫn ảnh mới |
| --- | --- | --- | --- |
| Cà phê sữa | `https://images.unsplash.com/photo-1461023058943-07fcbe16d735` | 200, image/jpeg | `/images/products/ca-phe-sua.svg` |
| Trà sữa | `https://images.unsplash.com/photo-1558857563-c0c6b8b7a1d9` | 404, text/html | `/images/products/tra-sua.svg` |
| Matcha | `https://images.unsplash.com/photo-1536256268855-8f64b7c2b9e7` | 404, text/html | `/images/products/matcha.svg` |
| Trà đào cam sả | `https://images.unsplash.com/photo-1556679343-c7306c1976bc` | 200, image/jpeg | `/images/products/tra-dao.svg` |
| Hồng trà | `https://images.unsplash.com/photo-1576092768241-dec231879fc3` | 200, image/jpeg | `/images/products/hong-tra.svg` |
| Oreo đá xay | `https://images.unsplash.com/photo-1579954115545-a955e57f8c1f` | 404, text/html | `/images/products/oreo-da-xay.svg` |

Trà sữa, Matcha và Oreo lỗi vì nguồn ảnh trả trang HTML 404 thay cho ảnh.
HTTP 404 không cho biết ảnh đã bị xóa hay ID ban đầu đã sai. Đây không phải
lỗi CSS hoặc thiếu cấu hình domain Next.js. Ba nguồn còn hoạt động cũng được
thay sang SVG để đồng bộ phong cách.

Các URL gốc nằm trong PostgreSQL và `apps/api/prisma/seed.ts`. Frontend chỉ
có một registry ảnh trong `src/lib/productImage.ts`, dùng chung cho hook,
thẻ, chi tiết và giỏ hàng. Registry dùng URL cũ làm khóa tương thích, không
request các URL này khi đã tìm thấy ảnh local. Không có fallback dữ liệu sản
phẩm giả hoặc fallback tự chuyển sang Unsplash.

## 2. Ánh xạ theo định danh ổn định

Ưu tiên ID production đã đọc từ API, không so khớp tên hiển thị:

| ID sản phẩm | File ảnh |
| --- | --- |
| `cmwfaunf10000jxr9zoh6x322` | `ca-phe-sua.svg` |
| `cmwfaunj30001jxr9elvss1oc` | `tra-sua.svg` |
| `cmwfaunli0002jxr9pjwdtmvp` | `matcha.svg` |
| `cmwfaunob0003jxr95mxw1k05` | `tra-dao.svg` |
| `cmwfaunxu0004jxr9gawwxuh7` | `hong-tra.svg` |
| `cmwfauo0q0005jxr9tygbwyjn` | `oreo-da-xay.svg` |

ID ưu tiên hơn imageUrl cũ, kể cả khi imageUrl đã bị gán nhầm hoặc là
placeholder. Khi ID khác ở môi trường khác, registry nhận diện URL ảnh cũ
chính xác, kể cả query string. Tên sản phẩm đổi không làm mất ánh xạ.

Những sản phẩm mới có ID và URL khác cần được cấu hình imageUrl local đúng
hoặc bổ sung ID vào registry sau khi kiểm tra; không đoán theo tên.

Giữ nguyên đường dẫn local đã có, gồm `americano.svg`, `bac-xiu.svg`,
`ca-phe-den.svg`, `ca-phe-sua.svg`, `cappuccino.svg`, `matcha.svg`,
`oreo-da-xay.svg`, `tra-dao.svg`, `tra-sua.svg`. Bốn món chưa có trong API
không được tạo thêm; đã kiểm tra ảnh local tương ứng hợp lệ, khác đường dẫn
và được resolver giữ nguyên. Hồng trà chưa có SVG phù hợp nên bổ sung riêng
`hong-tra.svg`, không dùng ảnh Trà đào hoặc placeholder làm ảnh chính.

## 3. Kiểm tra trùng và thiết kế

Đã raster hóa và xem bộ SVG cạnh nhau. Không có file trùng hoàn toàn theo
SHA-256. Sáu món production sử dụng sáu file riêng.

- Cà phê sữa và Cà phê đen có chung dáng ly nhưng khác nội dung: Cà phê sữa
  có lớp sữa sáng ở đáy và ống hút cam; Cà phê đen có thân đậm và ống hút tối.
  Không gán đổi hai file này. Nếu muốn dễ phân biệt hơn ở ảnh nhỏ, đề xuất
  tăng độ nổi bật của lớp sữa; chưa thay thiết kế.
- Americano và Cà phê đen là cặp giống nhau nhất về hình dáng và màu nước;
  khác màu ống hút, gradient và lớp crema. Có thể cân nhắc thay dáng ly hoặc
  thêm dấu hiệu phân biệt sau khi duyệt thiết kế; chưa thay SVG.
- Bạc xỉu có lớp sữa lớn hơn; Cappuccino dùng cốc có quai và latte art.
- Oreo và Matcha phù hợp. Giữ nguyên từng byte; đã so SHA-256 trước/sau.
  Cà phê sữa và Cà phê đen cũng giữ nguyên từng byte. Không xóa SVG nào.

## 4. Hiển thị và fallback

`ProductImage` dùng cùng resolver trong menu, chi tiết và giỏ hàng, bao gồm
các ảnh trong giỏ đã lưu từ phiên cũ. Không đổi dữ liệu giỏ hoặc logic tính giá.

Khi ảnh lỗi: ảnh chính → `placeholder.svg` có sẵn → SVG nhúng độc lập nếu
placeholder cũng không tải được. Nhánh cuối không cần request và không có
onError để lặp lại. Placeholder chỉ dùng khi nguồn không hợp lệ hoặc tải lỗi;
không là ảnh chính của sáu món đã có ánh xạ. Khi đổi nguồn ảnh, trạng thái lỗi
được reset bằng React key.

Giữ nguyên CSS, aspect-square, fill, sizes và object-contain của từng nơi;
không đổi bố cục, không kéo méo hoặc cắt ảnh để lấp khung.

## 5. File thay đổi

Các đường dẫn dưới đây tương đối với `apps/web`:

- `src/lib/productImage.ts`: registry ID/URL cũ và resolver dùng chung.
- `src/components/menu/ProductImage.tsx`: component ảnh và fallback hữu hạn.
- `src/hooks/useProducts.ts`: chuẩn hóa ảnh khi nhận danh mục.
- `src/components/menu/ProductCard.tsx`: dùng component chung, truyền ID.
- `src/components/menu/ProductConfigurator.tsx`: dùng component chung, truyền ID.
- `src/components/cart/CartPageClient.tsx`: áp dụng cùng mapping cho giỏ cũ/mới.
- `test/products-loading.test.mjs`: kiểm thử resolver, hook, fallback và giỏ cũ.
- `public/images/products/hong-tra.svg`: ảnh minh họa mới cho Hồng trà.
- `docs/product-images-audit.md`: báo cáo này.

`matcha.svg`, `oreo-da-xay.svg`, `tra-sua.svg` đã được thêm ở lượt sửa trước
và vẫn là file chưa commit; lượt đồng bộ này không sửa nội dung của chúng.

## 6. PostgreSQL và deploy

Không UPDATE database, không chạy migration hoặc seed; không sửa backend.
Không cần cập nhật PostgreSQL để frontend đã sửa hoạt động sau khi deploy.

Đề xuất cập nhật riêng `Product.imageUrl` của sáu ID ở trên sang đường dẫn
local tương ứng khi được phép: deploy frontend chứa ảnh trước, đọc/đối chiếu
ID và URL hiện tại, chỉ cập nhật trường ảnh, kiểm tra lại API. Không chạy lại
seed để cập nhật ảnh vì seed còn ghi các trường nghiệp vụ khác. Nếu ảnh cần
dùng ngoài frontend này, chọn URL tuyệt đối của nơi lưu trữ ảnh thay vì đường
dẫn tương đối. Khi chuyển môi trường hoặc thay ID, cần rà lại registry.

Cần deploy lại frontend Vercel để phát hành mapping, fallback và ảnh mới.
Không cần deploy backend. Chưa deploy, commit hoặc push. Không sửa Staff,
SePay, thanh toán, logic giỏ hàng hoặc tồn kho.

## 7. Kiểm thử

- `npx.cmd --no-install tsc --noEmit`: đạt.
- `npm.cmd run lint -- --max-warnings=0`: đạt, không lỗi/cảnh báo.
- `npm.cmd test`: 105/105 đạt, không bỏ qua test.
- `npm.cmd run build`: đạt, gồm TypeScript và sinh 13 trang.
- XML validation: toàn bộ 11 SVG sản phẩm có root SVG hợp lệ.
- Production server local: toàn bộ 11 SVG trả HTTP 200, `image/svg+xml`.
- `git diff --check`: đạt.

Đã chạy Chrome headless trên production build local, dùng snapshot danh mục
vừa đọc từ API production. Response danh mục được cấp lại trong trình duyệt;
cấu hình size/topping dùng fixture để thử chi tiết và thêm giỏ. Không gửi
thay đổi lên backend; giỏ thử nghiệm chỉ nằm trong profile trình duyệt tạm.

- Desktop 1440×1000 và mobile 390×844: đủ sáu ảnh tải được, sáu đường dẫn
  local riêng, object-fit contain, khung ảnh vuông, trang không tràn ngang;
  đã xem screenshot của cả hai viewport.
- Cà phê sữa: ảnh thẻ, cửa sổ chi tiết, thêm giỏ và giỏ cũ cùng đường dẫn.
- Kiểm thử render giỏ xác nhận tương tự cho cả sáu ID, không đổi dữ liệu giỏ.
- Khi chủ động chặn ảnh chính và placeholder trong trình duyệt: SVG nhúng
  vẫn tải được; mỗi URL lỗi chỉ request một lần, không có vòng lặp.
- Không có request tới `images.unsplash.com` trong phiên kiểm tra menu,
  chi tiết và giỏ hàng.
- Cà phê đen không có trong API hiện tại: kiểm tra file, HTTP, resolver và
  so sánh trực quan; không tuyên bố đã hiển thị món này trong menu production.

Next.js vẫn báo cảnh báo nhiều lockfile khi suy luận workspace root; build
thành công. Không thay cấu hình workspace trong phạm vi sửa ảnh.
