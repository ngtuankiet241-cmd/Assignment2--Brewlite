import Link from 'next/link';
import type { AuthUser } from '@/lib/auth';

export default function StaffHeader({ user, onLogout }: { user: AuthUser; onLogout: () => void }) {
  return (
    <header className="border-b border-coffee-700 bg-coffee-950 text-cream-50">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <span aria-hidden="true" className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cream-100 text-xl text-coffee-900">☕</span>
          <div><p className="text-xl font-black tracking-tight">BrewLite<span className="text-coffee-300"> / Staff</span></p><p className="text-xs text-coffee-300">Gọn từng đơn. Trọn từng ly.</p></div>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <div className="mr-2"><p className="max-w-48 truncate font-semibold">{user.fullName}</p><p className="text-xs text-coffee-300">{user.role === 'ADMIN' ? 'Quản trị viên' : 'Nhân viên pha chế'}</p></div>
          <Link href="/menu" className="inline-flex min-h-11 items-center rounded-full border border-coffee-600 px-4 text-xs font-semibold hover:bg-coffee-800 focus-visible:outline-2 focus-visible:outline-cream-100">Thực đơn</Link>
          <button type="button" onClick={onLogout} className="min-h-11 rounded-full bg-cream-100 px-4 text-xs font-bold text-coffee-950 hover:bg-white focus-visible:outline-2 focus-visible:outline-coffee-300">Đăng xuất</button>
        </div>
      </div>
    </header>
  );
}
