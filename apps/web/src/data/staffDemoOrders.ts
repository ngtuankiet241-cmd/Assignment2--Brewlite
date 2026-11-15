import type { StaffDemoMode, StaffOrder, StaffOrderStatus } from '@/types/staff';

// Synthetic fixtures only. Never read or modify real orders in phase 1.
const statuses: StaffOrderStatus[] = ['PAID', 'PREPARING', 'READY', 'PENDING', 'COMPLETED', 'PAYMENT_FAILED', 'CANCELLED'];
export const STAFF_DEMO_ORDERS: StaffOrder[] = statuses.map((status, index) => {
  const id = `DEMO-${String(index + 1).padStart(3, '0')}`;
  const paid = ['PAID', 'PREPARING', 'READY', 'COMPLETED'].includes(status);
  const quantity = index % 2 + 1;
  const unitPrice = index % 2 ? 48000 : 45000;
  const totalAmount = unitPrice * quantity;
  return {
    id,
    customerName: `Khách demo ${index + 1}`,
    tableNumber: index % 3 ? index + 1 : null,
    notes: index % 2 ? 'Ít đá, topping để riêng. Đây là ghi chú minh họa.' : null,
    status,
    totalAmount,
    createdAt: `2026-11-13T03:${String(10 + index * 3).padStart(2, '0')}:00.000Z`,
    updatedAt: '2026-11-13T04:00:00.000Z',
    items: [{
      id: `${id}-item`, productId: `demo-product-${index % 2 + 1}`,
      productName: index % 2 ? 'Cà phê sữa' : 'Matcha latte',
      unitPrice, quantity, size: index % 2 ? 'L' : 'M',
      toppings: index % 2 ? 'Trân châu đen x2' : null,
      itemTotal: totalAmount,
    }],
    payment: status === 'CANCELLED' ? null : {
      id: `${id}-payment`, orderId: id, amount: totalAmount, method: 'SEPAY_QR',
      status: paid ? 'SUCCESS' : status === 'PAYMENT_FAILED' ? 'FAILED' : 'PENDING',
      paidAt: paid ? '2026-11-13T03:30:00.000Z' : null,
    },
  };
});

export async function loadStaffDemoOrders(mode: StaffDemoMode): Promise<StaffOrder[]> {
  if (mode === 'error') throw new Error('Không thể tải bộ dữ liệu demo. Hãy thử lại.');
  if (mode === 'empty') return [];
  return structuredClone(STAFF_DEMO_ORDERS);
}
