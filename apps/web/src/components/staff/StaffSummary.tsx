import { getStaffSummary, type StaffOrder } from '@/types/staff';

export default function StaffSummary({ orders, loading = false }: { orders?: StaffOrder[]; loading?: boolean }) {
  const summary = orders ? getStaffSummary(orders) : undefined;
  const cards = [
    { label: 'Đơn trong trang', value: summary?.total, caption: 'Trang hiện tại, trước tìm kiếm', accent: 'bg-coffee-800' },
    { label: 'Chờ pha chế', value: summary?.waiting, caption: 'Đã thanh toán, chờ nhận', accent: 'bg-amber-500' },
    { label: 'Đang thực hiện', value: summary?.preparing, caption: 'Đang chuẩn bị & sẵn sàng', accent: 'bg-sky-500' },
    { label: 'Hoàn thành', value: summary?.completed, caption: 'Đã hoàn tất trong trang', accent: 'bg-emerald-500' },
  ];
  return (
    <section aria-label="Thống kê đơn trong trang hiện tại" aria-busy={loading} className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {cards.map((card) => <div key={card.label} className="relative min-w-0 overflow-hidden rounded-2xl border border-coffee-200 bg-white p-3 shadow-xs sm:p-4">
        <span aria-hidden="true" className={`absolute bottom-0 left-0 top-0 w-1 ${card.accent}`} />
        <p className="text-xs font-semibold text-coffee-600">{card.label}</p>
        <div className="mt-1 flex h-9 items-center text-3xl font-black tabular-nums text-coffee-950">
          {loading ? <><span aria-hidden="true" className="h-7 w-14 rounded-lg bg-coffee-100 motion-safe:animate-pulse" /><span className="sr-only">Đang tải</span></> : card.value ?? <span aria-label="Chưa có dữ liệu">—</span>}
        </div>
        <p className="mt-1 min-h-8 text-[11px] leading-4 text-coffee-500">{card.caption}</p>
      </div>)}
    </section>
  );
}
