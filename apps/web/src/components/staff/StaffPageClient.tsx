'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import type { AuthUser } from '@/lib/auth';
import { useStaffDemoOrders } from '@/hooks/useStaffDemoOrders';
import { canAccessStaff, filterStaffOrders, selectStaffOrder, formatStaffTime, STAFF_STATUSES, type StaffDemoMode, type StaffOrderFilter, type StaffOrderStatus } from '@/types/staff';
import StaffHeader from './StaffHeader';
import StaffSummary from './StaffSummary';
import StaffOrderList from './StaffOrderList';
import StaffOrderDetail from './StaffOrderDetail';
import { StaffEmptyState, StaffErrorState, StaffLoadingState } from './StaffStates';

const subscribeHydration = () => () => {};
const clientReady = () => true;
const serverReady = () => false;

function StaffDashboard({ user, onLogout }: { user: AuthUser; onLogout: () => void }) {
  const { orders, status, error, refreshedAt, mode, changeMode, refresh } = useStaffDemoOrders();
  const [filter, setFilter] = useState<StaffOrderFilter>('ALL');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const filtered = filterStaffOrders(orders, filter, search);
  const selected = selectStaffOrder(filtered, selectedId);
  const resetFilters = () => { setFilter('ALL'); setSearch(''); setSelectedId(null); };
  const refreshDemo = () => { setSelectedId(null); refresh(); };
  const selectOrder = (id: string) => {
    setSelectedId(id);
    if (typeof window !== 'undefined' && window.matchMedia('(max-width: 1023px)').matches) {
      window.requestAnimationFrame(() => document.getElementById('staff-order-detail')?.focus());
    }
  };
  const tabs: { id: StaffOrderFilter; label: string }[] = [
    { id: 'ALL', label: 'Tất cả' },
    ...Object.entries(STAFF_STATUSES).map(([id, { label }]) => ({ id: id as StaffOrderStatus, label })),
  ];

  return <div className="min-h-screen bg-cream-100 pb-20 text-coffee-950">
    <StaffHeader user={user} onLogout={onLogout} />
    <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><p className="text-xs font-bold uppercase tracking-[0.2em] text-coffee-500">Không gian vận hành</p><h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Một ca làm việc thật gọn.</h1><p className="mt-2 text-sm text-coffee-600">Theo dõi hàng đợi và xem chi tiết từng đơn tại quầy.</p></div>
        <button type="button" onClick={refreshDemo} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-coffee-800 px-5 text-sm font-bold text-white shadow-sm hover:bg-coffee-700 focus-visible:outline-2 focus-visible:outline-coffee-500"><span aria-hidden="true">↻</span> Làm mới demo</button>
      </div>
      <aside aria-label="Thông tin bản demo" className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-relaxed text-amber-950">
        <span className="mr-2 inline-block rounded-full bg-amber-200 px-2.5 py-0.5 text-[11px] font-black uppercase tracking-wider">Demo · Chưa kết nối API</span>
        Toàn bộ đơn và thống kê bên dưới là dữ liệu minh họa. Không tải đơn thật, không gửi cập nhật. Kiểm tra role hiện chỉ bảo vệ giao diện; phân quyền API cần được bổ sung ở Backend.
      </aside>
      {status === 'ready' && <StaffSummary orders={orders} />}
      <section aria-labelledby="staff-orders-heading">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 id="staff-orders-heading" className="text-xl font-black">Hàng đợi đơn demo</h2><p className="mt-1 text-xs text-coffee-600">{refreshedAt ? `Nạp demo lúc ${formatStaffTime(refreshedAt)} · không phải thời gian cập nhật đơn thật` : 'Bộ dữ liệu minh họa độc lập với hệ thống đặt hàng'}</p></div>
          <label className="flex flex-wrap items-center gap-2 text-xs text-coffee-600">Kiểm tra giao diện demo
            <select value={mode} onChange={(event) => { setSelectedId(null); changeMode(event.target.value as StaffDemoMode); }} className="min-h-11 rounded-xl border border-coffee-200 bg-white px-3 text-sm text-coffee-900 focus-visible:outline-2 focus-visible:outline-coffee-500">
              <option value="normal">Có đơn demo</option><option value="loading">Loading</option><option value="empty">Empty</option><option value="error">Error</option>
            </select>
          </label>
        </div>
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <label className="min-w-0 flex-1 text-xs font-semibold text-coffee-700" htmlFor="staff-order-search">
            Tìm mã đơn, tên khách hoặc số bàn
            <input id="staff-order-search" type="search" value={search}
              onChange={(event) => { setSearch(event.target.value); setSelectedId(null); }}
              placeholder="Ví dụ: DEMO-002, Khách demo, bàn 2"
              className="mt-1.5 block min-h-11 w-full rounded-xl border border-coffee-200 bg-white px-4 text-sm font-normal text-coffee-950 placeholder:text-coffee-400 focus-visible:outline-2 focus-visible:outline-coffee-500" />
          </label>
          {(search.trim() || filter !== 'ALL') && <button type="button" onClick={resetFilters} className="min-h-11 rounded-xl border border-coffee-200 bg-white px-4 text-xs font-bold text-coffee-800 hover:bg-coffee-50">Xóa tìm kiếm & bộ lọc</button>}
        </div>
        <div role="group" aria-label="Lọc trạng thái đơn" className="mt-4 flex gap-2 overflow-x-auto pb-3 lg:flex-wrap">
          {tabs.map((tab) => <button key={tab.id} type="button" aria-pressed={filter === tab.id} onClick={() => { setFilter(tab.id); setSelectedId(null); }} className={`inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border px-4 text-xs font-bold transition focus-visible:outline-2 focus-visible:outline-coffee-500 ${filter === tab.id ? 'border-coffee-800 bg-coffee-800 text-white' : 'border-coffee-200 bg-white text-coffee-700 hover:border-coffee-400'}`}>
            {tab.label}<span className={`rounded-full px-1.5 py-0.5 tabular-nums ${filter === tab.id ? 'bg-white/15' : 'bg-coffee-50'}`}>{filterStaffOrders(orders, tab.id, search).length}</span>
          </button>)}
        </div>
        {status === 'ready' && <p role="status" className="mb-3 text-xs text-coffee-600">Hiển thị {filtered.length} / {orders.length} đơn demo · Thống kê phía trên tính trên toàn bộ bộ dữ liệu.</p>}
        <div className="mt-2 grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
          <div aria-live="polite" aria-busy={status === 'loading'}>
            {status === 'loading' && <StaffLoadingState />}
            {status === 'error' && <StaffErrorState message={error} onRetry={refreshDemo} />}
            {status === 'ready' && filtered.length === 0 && <StaffEmptyState filtered={orders.length > 0 && (filter !== 'ALL' || search.trim() !== '')} onReset={orders.length > 0 ? resetFilters : refreshDemo} />}
            {status === 'ready' && filtered.length > 0 && <StaffOrderList orders={filtered} selectedId={selected?.id} onSelect={selectOrder} />}
          </div>
          {status === 'ready' && selected ? <StaffOrderDetail order={selected} /> : <div className="hidden rounded-3xl border border-dashed border-coffee-200 p-12 text-center text-sm text-coffee-500 lg:block">Chi tiết đơn sẽ hiển thị tại đây.</div>}
        </div>
      </section>
      <footer className="border-t border-coffee-200 pt-5 text-xs text-coffee-500">BrewLite Staff · Bản giao diện demo · Không dùng để vận hành đơn thật</footer>
    </main>
  </div>;
}

export default function StaffPageClient() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const hydrated = useSyncExternalStore(subscribeHydration, clientReady, serverReady);

  useEffect(() => {
    if (hydrated && !user) router.replace('/login');
  }, [hydrated, user, router]);

  if (!hydrated) return <main className="mx-auto w-full max-w-xl px-4 py-16"><StaffLoadingState /></main>;
  if (!user) return <main className="px-4 py-20 text-center" role="status"><h1 className="text-xl font-bold">Đang chuyển đến đăng nhập...</h1><Link href="/login" className="mt-4 inline-flex min-h-11 items-center text-sm font-bold text-coffee-800 underline">Đăng nhập</Link></main>;
  if (!canAccessStaff(user.role)) return <main className="mx-auto w-full max-w-lg px-4 py-20"><div className="rounded-3xl border border-coffee-200 bg-white p-8 text-center"><p aria-hidden="true" className="text-3xl">🔒</p><h1 className="mt-4 text-xl font-black">Bạn không có quyền truy cập</h1><p className="mt-2 text-sm text-coffee-600">Khu vực này dành cho nhân viên pha chế và quản trị viên.</p><Link href="/menu" className="mt-6 inline-flex min-h-11 items-center rounded-full bg-coffee-800 px-6 text-sm font-bold text-white">Về thực đơn</Link></div></main>;

  // Remounting discards selections and pending demo loads when accounts change.
  return <StaffDashboard key={user.id} user={user} onLogout={logout} />;
}
