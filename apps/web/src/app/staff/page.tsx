import type { Metadata } from 'next';
import StaffPageClient from '@/components/staff/StaffPageClient';

export const metadata: Metadata = {
  title: 'Quầy nhân viên – BrewLite',
  description: 'Xem hàng đợi và chi tiết đơn hàng BrewLite dành cho nhân viên.',
  robots: { index: false, follow: false },
};

export default function StaffPage() {
  return <StaffPageClient />;
}
