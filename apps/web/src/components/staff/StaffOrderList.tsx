import { formatStaffMoney, formatStaffTime, type StaffOrder } from '@/types/staff';
import StaffOrderStatus from './StaffOrderStatus';

export default function StaffOrderList({ orders, selectedId, onSelect }: { orders: StaffOrder[]; selectedId?: string; onSelect: (id: string) => void }) {
  return (
    <ul aria-label="Danh sách đơn hàng" className="space-y-3">
      {orders.map((order) => <li key={order.id}>
        <button type="button" aria-pressed={selectedId === order.id} aria-controls="staff-order-detail" onClick={() => onSelect(order.id)}
          className={`w-full min-w-0 rounded-2xl border p-4 text-left transition focus-visible:outline-2 focus-visible:outline-coffee-600 ${selectedId === order.id ? 'border-coffee-600 bg-coffee-50 ring-1 ring-coffee-600' : 'border-coffee-200 bg-white hover:border-coffee-400'}`}>
          <div className="flex flex-wrap items-center justify-between gap-2"><span className="break-all font-mono text-sm font-bold text-coffee-900">#{order.id}</span><StaffOrderStatus status={order.status} /></div>
          <p className="mt-2 break-words text-sm font-semibold text-coffee-950">{order.customerName} <span className="font-normal text-coffee-500">· {order.tableNumber ? `Bàn ${order.tableNumber}` : 'Mang đi'}</span></p>
          <div className="mt-3 flex items-end justify-between gap-2"><p className="text-xs text-coffee-600">{order.items.reduce((sum, item) => sum + item.quantity, 0)} ly · {formatStaffTime(order.createdAt)}</p><span className="text-sm font-bold text-coffee-900">{formatStaffMoney(order.totalAmount)}</span></div>
        </button>
      </li>)}
    </ul>
  );
}
