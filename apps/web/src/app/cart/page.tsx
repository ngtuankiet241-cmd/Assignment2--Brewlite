import type { Metadata } from 'next';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import CartPageClient from '@/components/cart/CartPageClient';

export const metadata: Metadata = {
  title: 'Giỏ hàng – BrewLite',
  description: 'Xem lại các món nước, size và topping bạn đã chọn tại BrewLite.',
};

export default function CartPage() {
  return (
    <div className="flex min-h-screen flex-col bg-cream-100 text-coffee-950">
      <Header />
      <CartPageClient />
      <Footer />
    </div>
  );
}
