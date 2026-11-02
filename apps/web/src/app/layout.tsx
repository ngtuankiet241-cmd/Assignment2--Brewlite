import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'BrewLite – Đặt cà phê không tiền mặt cho sinh viên & Gen Z',
  description:
    'Ứng dụng đặt cà phê không dùng tiền mặt (Cashless Coffee) tiện lợi, nhanh chóng, tối ưu cho sinh viên và giới trẻ năng động.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" className="h-full scroll-smooth">
      <body className="min-h-full flex flex-col bg-cream-100 text-coffee-950 antialiased selection:bg-coffee-200 selection:text-coffee-900">
        {children}
      </body>
    </html>
  );
}
