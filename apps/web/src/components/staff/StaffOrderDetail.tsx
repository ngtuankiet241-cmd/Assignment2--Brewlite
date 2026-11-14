import { formatStaffMoney, formatStaffTime, STAFF_NEXT_ACTION, type StaffOrder } from '@/types/staff';
import StaffOrderStatus from './StaffOrderStatus';

export default function StaffOrderDetail({ order, updatesEnabled = false, updating = false, onUpdate }: {
  order: StaffOrder; updatesEnabled?: boolean; updating?: boolean; onUpdate?: () => void;
}) {
  const action = STAFF_NEXT_ACTION[order.status];
  const paymentLabel = !order.payment ? 'Chưa có giao dịch' : { SUCCESS: 'Đã thanh toán', PENDING: 'Chờ thanh toán', FAILED: 'Thanh toán thất bại' }[order.payment.status];
  return (
    <section aria-labelledby="staff-detail-heading" className="min-w-0 rounded-3xl border border-coffee-200 bg-white shadow-xs">
      <div className="border-b border-coffee-100 p-5 sm:p-6">
        <p className="text-[11px] font-bold uppercase tracking-widest text-coffee-500">Chi tiết đơn hàng</p>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2"><h2 id="staff-detail-heading" className="break-all text-xl font-black text-coffee-950">#{order.id}</h2><StaffOrderStatus status={order.status} /></div>
        <p className="mt-2 break-words text-sm text-coffee-600">{order.customerName} · {order.tableNumber ? `Bàn ${order.tableNumber}` : 'Mang đi'} · {formatStaffTime(order.createdAt)}</p>
      </div>
      <div className="p-5 sm:p-6">
        <ul className="divide-y divide-coffee-100" aria-label="Món trong đơn hàng">
          {order.items.map((item) => <li key={item.id} className="flex flex-wrap justify-between gap-2 py-3 first:pt-0 sm:flex-nowrap sm:gap-4">
            <div className="min-w-0"><p className="break-words font-bold text-coffee-950">{item.quantity} × {item.productName}</p><p className="mt-1 text-xs text-coffee-600">Size {item.size} · {formatStaffMoney(item.unitPrice)} / ly</p><p className="mt-1 break-words text-xs text-coffee-600">{item.toppings ? `+ ${item.toppings}` : 'Không thêm topping'}</p></div>
            <span className="shrink-0 text-sm font-bold text-coffee-900">{formatStaffMoney(item.itemTotal)}</span>
          </li>)}
        </ul>
        <div className="mt-4 rounded-2xl bg-cream-100 p-4"><h3 className="text-xs font-bold text-coffee-800">Ghi chú pha chế</h3><p className="mt-1 whitespace-pre-wrap break-words text-sm text-coffee-700">{order.notes || 'Không có ghi chú.'}</p></div>
        <dl className="mt-5 space-y-3 text-sm"><div className="flex flex-wrap justify-between gap-2"><dt className="text-coffee-600">Thanh toán</dt><dd className="font-semibold text-coffee-900">{paymentLabel}</dd></div><div className="flex justify-between gap-2"><dt className="text-coffee-600">Phương thức</dt><dd>{order.payment ? order.payment.method === 'SEPAY_QR' ? 'SePay QR' : 'Tiền mặt' : '—'}</dd></div><div className="flex justify-between gap-2 border-t border-coffee-200 pt-4"><dt className="font-bold text-coffee-950">Tổng tiền</dt><dd className="text-xl font-black text-coffee-900">{formatStaffMoney(order.totalAmount)}</dd></div></dl>
        <div className="mt-6 border-t border-coffee-100 pt-5">
          <p className="text-xs font-semibold leading-relaxed text-coffee-600 [overflow-wrap:anywhere]">PAID → PREPARING → READY → COMPLETED</p>
          {action ? <button type="button" disabled={!updatesEnabled || updating || !onUpdate} onClick={onUpdate} aria-busy={updating} aria-describedby={!updatesEnabled ? 'staff-action-notice' : undefined} className="mt-3 min-h-12 w-full rounded-full bg-coffee-800 px-4 text-sm font-bold text-white hover:bg-coffee-700 focus-visible:outline-2 focus-visible:outline-coffee-500 disabled:cursor-not-allowed disabled:bg-coffee-100 disabled:text-coffee-500">{updating ? 'Đang cập nhật…' : action.label}</button> : <p className="mt-3 text-sm text-coffee-600">{order.status === 'CANCELLED' || order.status === 'COMPLETED' ? 'Đơn đã kết thúc.' : 'Chưa đủ điều kiện chuẩn bị đơn.'}</p>}
          {order.status === 'PAID' && <div className="mt-3" title="Chức năng đang phát triển" tabIndex={0} aria-label="Hủy đơn: Chức năng đang phát triển"><button type="button" disabled title="Chức năng đang phát triển" aria-describedby="staff-cancel-notice" className="min-h-12 w-full cursor-not-allowed rounded-full border border-coffee-200 px-4 text-sm font-bold text-coffee-400">Hủy đơn</button><p id="staff-cancel-notice" className="mt-2 text-xs text-coffee-500">Chức năng đang phát triển</p></div>}
          {!updatesEnabled && <p id="staff-action-notice" className="mt-3 text-xs leading-relaxed text-coffee-600">Cập nhật trạng thái đang khóa, chờ xác minh quy tắc thanh toán. Trang này chỉ xem đơn hàng.</p>}
        </div>
      </div>
    </section>
  );
}
