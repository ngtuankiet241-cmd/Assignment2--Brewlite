import type { Metadata } from 'next';
import MenuPageClient from '@/components/menu/MenuPageClient';

export const metadata: Metadata = {
  title: 'Thực đơn đồ uống – BrewLite',
  description:
    'Khám phá thực đơn cà phê Robusta và trà trái cây thanh mát, thanh toán 100% không dùng tiền mặt tại BrewLite.',
};

export default function MenuPage() {
  return <MenuPageClient />;
}

