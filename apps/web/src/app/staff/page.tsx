import type { Metadata } from 'next';
import StaffPageClient from '@/components/staff/StaffPageClient';

export const metadata: Metadata = {
  title: 'Quầy nhân viên – BrewLite',
  description: 'Giao diện nhân viên BrewLite — bản demo chưa kết nối API.',
  robots: { index: false, follow: false },
};

export default function StaffPage() {
  return <StaffPageClient />;
}
