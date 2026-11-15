'use client';

import { useEffect, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import type { AuthUser } from '@/lib/auth';
import { useStaffOrders } from '@/hooks/useStaffOrders';
import { canAccessStaff, formatStaffTime, STAFF_STATUSES, type StaffOrderFilter, type StaffOrderStatus } from '@/types/staff';
import StaffHeader from './StaffHeader';
import StaffOrderList from './StaffOrderList';
import StaffOrderDetail from './StaffOrderDetail';
import { StaffDetailErrorState, StaffEmptyState, StaffErrorState, StaffLoadingState } from './StaffStates';

const subscribeHydration = () => () => {};
const clientReady = () => true;
const serverReady = () => false;

function StaffDashboard({ user, onLogout }: { user: AuthUser; onLogout: () => void }) {
  const { orders, visibleOrders: filtered, selectedId, detail, status, error, refreshedAt,
    pagination, filter, page, search, changeFilter, changePage, changeSearch,
    selectOrder: chooseOrder, resetFilters, refresh, retryDetail,
    statusUpdatesEnabled, updatingId, notice, updateSelectedOrder } = useStaffOrders();
  const selectOrder = (id: string) => {
    chooseOrder(id);
    if (typeof window !== 'undefined' && window.matchMedia('(max-width: 1023px)').matches) {
      window.requestAnimationFrame(() => document.getElementById('staff-order-detail')?.focus());
    }
  };
  const tabs: { id: StaffOrderFilter; label: string }[] = [
    { id: 'ALL', label: 'Tất cả' },
    ...Object.entries(STAFF_STATUSES).map(([id, { label }]) => ({ id: id as StaffOrderStatus, label })),
  ];

  return <div className="min-h-screen bg-cream-100 pb-8 text-coffee-950">
    <StaffHeader user={user} onLogout={onLogout} />
    <main className="mx-auto max-w-7xl space-y-4 px-4 py-4 sm:px-6 lg:px-8 lg:py-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-2xl font-black tracking-tight sm:text-3xl">Một ca làm việc thật gọn.</h1><p className="mt-1 text-sm text-coffee-600">Theo dõi hàng đợi và chi tiết đơn tại quầy.</p></div>
        <button type="button" onClick={refresh} disabled={status === 'loading'} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-coffee-800 px-5 text-sm font-bold text-white shadow-sm hover:bg-coffee-700 focus-visible:outline-2 focus-visible:outline-coffee-500 disabled:opacity-50"><span aria-hidden="true">↻</span> Làm mới</button>
      </div>
      {notice && <p role={notice.kind === 'error' ? 'alert' : 'status'} className={`rounded-2xl border p-4 text-sm ${notice.kind === 'error' ? 'border-red-200 bg-red-50 text-red-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}>{notice.message}</p>}
      <section aria-labelledby="staff-orders-heading">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 id="staff-orders-heading" className="text-xl font-black">Hàng đợi đơn hàng</h2><p className="mt-1 text-xs text-coffee-600">{refreshedAt ? `Tải danh sách lúc ${formatStaffTime(refreshedAt)}` : 'Danh sách đơn hàng từ hệ thống'}</p></div>
        </div>
        <div className="mt-3 flex items-end gap-2 sm:gap-3">
          <label className="min-w-0 flex-1 text-xs font-semibold text-coffee-700" htmlFor="staff-order-search">
            Tìm trong trang hiện tại
            <input id="staff-order-search" type="search" value={search}
              onChange={(event) => changeSearch(event.target.value)}
              placeholder="Mã đơn, tên khách hoặc số bàn"
              className="mt-1.5 block min-h-11 w-full rounded-xl border border-coffee-200 bg-white px-3 text-base font-normal text-coffee-950 placeholder:text-coffee-400 focus-visible:outline-2 focus-visible:outline-coffee-500 sm:px-4 sm:text-sm" />
          </label>
          <button type="button" onClick={resetFilters} disabled={!search.trim() && filter === 'ALL'} aria-label="Xóa tìm kiếm và bộ lọc" className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-xl border border-coffee-200 bg-white px-3 text-xs font-bold text-coffee-800 hover:bg-coffee-50 focus-visible:outline-2 focus-visible:outline-coffee-500 disabled:cursor-default disabled:opacity-40 sm:px-4"><span aria-hidden="true" className="text-lg sm:hidden">×</span><span className="hidden sm:inline">Xóa tìm kiếm & bộ lọc</span></button>
        </div>
        <label className="mt-3 flex items-center gap-3 text-xs font-semibold text-coffee-700 sm:hidden" htmlFor="staff-status-filter">Trạng thái
          <select id="staff-status-filter" value={filter} onChange={(event) => changeFilter(event.target.value as StaffOrderFilter)} className="min-h-11 min-w-0 flex-1 rounded-xl border border-coffee-200 bg-white px-3 text-base text-coffee-950 focus-visible:outline-2 focus-visible:outline-coffee-500">
            {tabs.map((tab) => <option key={tab.id} value={tab.id}>{tab.label}</option>)}
          </select>
        </label>
        <div role="group" aria-label="Lọc trạng thái đơn" className="mt-3 hidden flex-wrap gap-2 sm:flex">
          {tabs.map((tab) => <button key={tab.id} type="button" aria-pressed={filter === tab.id} onClick={() => changeFilter(tab.id)} className={`inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border px-4 text-xs font-bold transition focus-visible:outline-2 focus-visible:outline-coffee-500 ${filter === tab.id ? 'border-coffee-800 bg-coffee-800 text-white' : 'border-coffee-200 bg-white text-coffee-700 hover:border-coffee-400'}`}>
            {tab.label}
          </button>)}
        </div>
        <p role="status" className="mb-3 mt-3 min-h-4 text-xs leading-4 text-coffee-600">{status === 'ready' ? <>Hiển thị {filtered.length} / {orders.length} đơn trong trang · Tổng theo bộ lọc: {pagination?.total ?? 0} đơn.</> : status === 'loading' ? 'Đang tải đơn hàng…' : 'Chưa tải được danh sách đơn hàng.'}</p>
        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
          <div aria-live="polite" aria-busy={status === 'loading'} className="min-w-0 min-h-72">
            {status === 'loading' && <StaffLoadingState />}
            {status === 'error' && <StaffErrorState message={error} onRetry={refresh} />}
            {status === 'ready' && filtered.length === 0 && <StaffEmptyState filtered={search.trim() !== '' || filter !== 'ALL'} hasOrders={(pagination?.total ?? 0) > 0} onReset={search.trim() !== '' || filter !== 'ALL' ? resetFilters : refresh} />}
            {status === 'ready' && filtered.length > 0 && <StaffOrderList orders={filtered} selectedId={selectedId} onSelect={selectOrder} />}
          </div>
          <div id="staff-order-detail" tabIndex={-1} aria-label="Chi tiết đơn hàng" aria-busy={detail.status === 'loading'} className="min-w-0 scroll-mt-6 focus-visible:outline-2 focus-visible:outline-coffee-500 lg:sticky lg:top-6">
            {status === 'ready' && detail.status === 'loading' ? <StaffLoadingState variant="detail" />
              : status === 'ready' && detail.status === 'error' ? <StaffDetailErrorState message={detail.error?.message ?? 'Không thể tải chi tiết đơn.'} notFound={detail.error?.code === 'NOT_FOUND'} onRetry={retryDetail} onRefresh={refresh} />
              : status === 'ready' && detail.data ? <StaffOrderDetail order={detail.data} updatesEnabled={statusUpdatesEnabled} updating={Boolean(updatingId)} onUpdate={updateSelectedOrder} />
              : <div className="hidden min-h-72 items-center justify-center rounded-3xl border border-dashed border-coffee-200 p-6 text-center text-sm text-coffee-500 lg:flex">Chọn một đơn trong danh sách để xem chi tiết.</div>}
          </div>
        </div>
        {status === 'ready' && pagination && <nav aria-label="Phân trang đơn hàng" className="mt-5 flex flex-wrap items-center justify-between gap-3 text-sm">
          <button type="button" disabled={page <= 1} onClick={() => changePage(page - 1)} className="min-h-11 rounded-full border border-coffee-200 bg-white px-5 font-bold disabled:opacity-40">Trang trước</button>
          <span>Trang {pagination.page} / {Math.max(1, pagination.totalPages)} · {pagination.total} đơn theo bộ lọc</span>
          <button type="button" disabled={page >= pagination.totalPages} onClick={() => changePage(page + 1)} className="min-h-11 rounded-full border border-coffee-200 bg-white px-5 font-bold disabled:opacity-40">Trang sau</button>
        </nav>}
      </section>
      <footer className="border-t border-coffee-200 pt-3 text-xs text-coffee-500">BrewLite Staff · {statusUpdatesEnabled ? 'Quản lý trạng thái pha chế' : 'Cập nhật trạng thái đang khóa'}</footer>
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

  // Remounting clears private data and cancels requests when accounts/roles change.
  return <StaffDashboard key={`${user.id}:${user.role}`} user={user} onLogout={logout} />;
}
