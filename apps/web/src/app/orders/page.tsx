import OrdersPageClient from '@/components/orders/OrdersPageClient';

export const metadata = {
  title: 'Lịch sử & Trạng thái Đơn hàng – BrewLite',
  description: 'Theo dõi tiến độ pha chế và lịch sử đơn hàng của bạn tại BrewLite.',
};

export default function OrdersPage() {
  return <OrdersPageClient />;
}

