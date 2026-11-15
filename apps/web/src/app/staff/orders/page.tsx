import Link from 'next/link';
import StaffOrdersClient from '@/components/staff/StaffOrdersClient';

export const metadata = {
  title: 'Quản lý đơn hàng - BrewLite',
  description: 'Quản lý đơn hàng và yêu cầu hoàn tiền tại BrewLite.',
};

export default function StaffOrdersPage() {
  return (
    <>
      <nav
        aria-label="Điều hướng nhân viên"
        style={{
          maxWidth: 1050,
          margin: '18px auto 0',
          padding: '0 18px',
          display: 'flex',
          justifyContent: 'flex-end',
        }}
      >
        <Link
          href="/staff/refunds"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            minHeight: 42,
            padding: '10px 16px',
            borderRadius: 10,
            background: '#292524',
            color: '#ffffff',
            fontWeight: 700,
            textDecoration: 'none',
          }}
        >
          Quản lý hoàn tiền
        </Link>
      </nav>
      <StaffOrdersClient />
    </>
  );
}
