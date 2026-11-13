import { getStaffSummary, type StaffOrder } from '@/types/staff';

export default function StaffSummary({ orders }: { orders: StaffOrder[] }) {
  const summary = getStaffSummary(orders);
  const cards = [
    { label: 'Tổng đơn demo', value: summary.total, caption: 'Toàn bộ dữ liệu minh họa', accent: 'bg-coffee-800' },
    { label: 'Chờ pha chế', value: summary.waiting, caption: 'Đã thanh toán, chờ nhận', accent: 'bg-amber-500' },
    { label: 'Đang thực hiện', value: summary.preparing, caption: 'Đang chuẩn bị & sẵn sàng', accent: 'bg-sky-500' },
    { label: 'Hoàn thành', value: summary.completed, caption: 'Đơn demo đã hoàn tất', accent: 'bg-emerald-500' },
  ];
  return (
    <section aria-label="Thống kê đơn demo" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {cards.map((card) => <div key={card.label} className="relative overflow-hidden rounded-2xl border border-coffee-200 bg-white p-4 shadow-xs sm:p-5">
        <span aria-hidden="true" className={`absolute bottom-0 left-0 top-0 w-1 ${card.accent}`} />
        <p className="text-xs font-semibold text-coffee-600">{card.label}</p><p className="mt-2 text-3xl font-black tabular-nums text-coffee-950">{card.value}</p><p className="mt-1 text-[11px] text-coffee-500">{card.caption}</p>
      </div>)}
    </section>
  );
}
