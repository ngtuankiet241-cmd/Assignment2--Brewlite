# Hướng dẫn sử dụng báo cáo BrewLite – Assignment 2

## 1. Chạy trên Overleaf

1. Tải file ZIP lên bằng **New Project → Upload Project**.
2. Vào **Menu / Settings**, thiết lập:
   - **Main document:** `main.tex`.
   - **Compiler:** `XeLaTeX`.
3. Nhấn **Recompile** để tạo PDF.

Nếu mục lục chưa cập nhật đúng, nhấn **Recompile** thêm lần nữa.

## 2. Viết thêm nội dung

Mở `main.tex`, tìm mục cần viết và thay dòng:

```latex
% Điền nội dung tại đây.
```

bằng nội dung của bạn. Ví dụ:

```latex
\section{Tổng quan Assignment 2}

BrewLite là hệ thống hỗ trợ khách hàng xem menu,
đặt hàng và thanh toán trực tuyến.

\subsection{Phạm vi sản phẩm}

Hệ thống gồm frontend Next.js, backend NestJS
và cơ sở dữ liệu PostgreSQL.
```

**Các lệnh thường dùng:**

```latex
% Tạo mục
\section{Tên mục chính}
\subsection{Tên mục con}
\subsubsection{Tên mục nhỏ}

% Định dạng chữ
\textbf{Nội dung in đậm}
\textit{Nội dung in nghiêng}

% Danh sách gạch đầu dòng
\begin{itemize}
    \item Nội dung thứ nhất.
    \item Nội dung thứ hai.
\end{itemize}

% Danh sách đánh số
\begin{enumerate}
    \item Bước thứ nhất.
    \item Bước thứ hai.
\end{enumerate}
```

Để một dòng trống giữa hai đoạn văn. Dòng bắt đầu bằng `%` là chú thích và không xuất hiện trong PDF.

## 3. Chèn hình ảnh

Tải hình vào thư mục `assets`, sau đó chèn:

```latex
\begin{figure}[htbp]
    \centering
    \includegraphics[width=0.9\textwidth]{assets/ten-hinh.png}
    \caption{Tên hình}
    \label{fig:ten-hinh}
\end{figure}
```

Tên tệp nên không dấu, không có khoảng trắng và phải khớp chính xác với đường dẫn trong mã.

## 4. Điều chỉnh khoảng trống và trang

```latex
\vspace{8mm}  % Tạo khoảng trống
\clearpage   % Chuyển sang trang mới
```

Khi viết thêm, có thể xóa các lệnh tạo khoảng trống hoặc ngắt trang trong phần nội dung để LaTeX tự dàn trang.

Mục lục tự lấy tên mục và số trang, không cần nhập thủ công.

## 5. Kiểm tra và tải PDF

- Nhấn **Recompile** sau khi chỉnh sửa.
- Kiểm tra nội dung, hình ảnh và mục lục trong bản xem trước.
- Chọn **Download PDF** để tải báo cáo.

Nếu gặp lỗi `fontspec`, kiểm tra lại **Compiler = XeLaTeX**. Nếu gặp lỗi `no legal \end found`, kiểm tra **Main document = main.tex** và giữ nguyên hai lệnh `\begin{document}`, `\end{document}`.
