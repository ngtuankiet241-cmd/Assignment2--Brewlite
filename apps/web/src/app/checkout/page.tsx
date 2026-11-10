import type { Metadata } from 'next';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import CheckoutPageClient from '@/components/checkout/CheckoutPageClient';

export const metadata: Metadata = {
  title: 'Thanh toán & Đặt hàng – BrewLite',
  description: 'Xác nhận thông tin khách hàng và thanh toán đơn hàng BrewLite bằng SePay QR hoặc tiền mặt.',
};

export default function CheckoutPage() {
  return (
    <div className="flex min-h-screen flex-col bg-cream-100 text-coffee-950">
      <Header />
      <CheckoutPageClient />
      <Footer />
    </div>
  );
}

