import type { Metadata } from 'next';
import MenuPageClient from '@/components/menu/MenuPageClient';

export const metadata: Metadata = {
  title: 'BrewLite – Đặt cà phê không tiền mặt cho sinh viên & Gen Z',
  description:
    'Ứng dụng đặt đồ uống không dùng tiền mặt (Cashless Coffee) tiện lợi, siêu tốc cho sinh viên và giới trẻ.',
};

export default function HomePage() {
  return <MenuPageClient />;
}
