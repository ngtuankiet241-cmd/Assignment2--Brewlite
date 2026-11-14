// Staff API contract verified against the controller, service and Prisma schema.
export type StaffOrderStatus = 'PENDING' | 'PAYMENT_FAILED' | 'PAID' | 'PREPARING' | 'READY' | 'COMPLETED' | 'CANCELLED';
export type StaffOrderFilter = 'ALL' | StaffOrderStatus;
export type StaffDemoMode = 'normal' | 'loading' | 'empty' | 'error';

export interface StaffOrdersQuery {
  status?: StaffOrderStatus;
  page?: number;
  limit?: number;
}

export interface StaffOrdersPage {
  data: StaffOrderDetails[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

export interface StaffUpdateStatusInput {
  status: 'PREPARING' | 'READY' | 'COMPLETED';
}

export interface StaffOrderItem {
  id: string;
  productId: string;
  productName: string;
  unitPrice: number;
  quantity: number;
  size: string;
  toppings: string | null;
  itemTotal: number;
}

// UI projection shared with the existing demo; API responses use the stricter types below.
export interface StaffOrder {
  id: string;
  customerName: string;
  customerPhone?: string;
  tableNumber: number | null;
  notes: string | null;
  status: StaffOrderStatus;
  totalAmount: number;
  createdAt: string;
  updatedAt: string;
  items: StaffOrderItem[];
  payment: {
    id: string;
    amount: number;
    method: 'SEPAY_QR' | 'CASH';
    status: 'PENDING' | 'SUCCESS' | 'FAILED';
    paidAt: string | null;
  } | null;
}

/** Scalar Order returned by PATCH; relations must be fetched separately. */
export interface StaffOrderScalar extends Omit<StaffOrder, 'items' | 'payment' | 'customerPhone'> {
  userId: string | null;
  customerPhone: string;
  subtotalAmount: number;
  discountAmount: number;
  reservationStatus: 'HELD' | 'CONSUMED' | 'RELEASED' | null;
  reservationExpiresAt: string | null;
  promotionId: string | null;
  promotionCode: string | null;
}

/** GET list/detail includes item snapshots and the selected payment fields. */
export interface StaffOrderDetails extends StaffOrderScalar {
  items: (StaffOrderItem & { orderId: string })[];
  payment: StaffOrder['payment'];
}

export const STAFF_STATUSES: Record<StaffOrderStatus, { label: string; color: string }> = {
  PENDING: { label: 'PENDING', color: 'border-stone-200 bg-stone-100 text-stone-700' },
  PAYMENT_FAILED: { label: 'PAYMENT_FAILED', color: 'border-red-200 bg-red-50 text-red-800' },
  PAID: { label: 'PAID', color: 'border-amber-200 bg-amber-50 text-amber-900' },
  PREPARING: { label: 'PREPARING', color: 'border-orange-200 bg-orange-50 text-orange-900' },
  READY: { label: 'READY', color: 'border-sky-200 bg-sky-50 text-sky-900' },
  COMPLETED: { label: 'COMPLETED', color: 'border-emerald-200 bg-emerald-50 text-emerald-800' },
  CANCELLED: { label: 'CANCELLED', color: 'border-stone-200 bg-stone-100 text-stone-600' },
};

// UI affordances only; the backend must enforce transitions and authorization.
export const STAFF_NEXT_ACTION: Partial<Record<StaffOrderStatus, { status: StaffOrderStatus; label: string }>> = {
  PAID: { status: 'PREPARING', label: 'Nhận đơn & chuẩn bị' },
  PREPARING: { status: 'READY', label: 'Đánh dấu sẵn sàng' },
  READY: { status: 'COMPLETED', label: 'Hoàn thành đơn' },
};

export function canAccessStaff(role?: string): boolean {
  return role === 'BARISTA' || role === 'ADMIN';
}

export function getStaffSummary(orders: StaffOrder[]) {
  return {
    total: orders.length,
    waiting: orders.filter((order) => order.status === 'PAID').length,
    preparing: orders.filter((order) => order.status === 'PREPARING' || order.status === 'READY').length,
    completed: orders.filter((order) => order.status === 'COMPLETED').length,
  };
}

function normalizeStaffSearch(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd').toLowerCase().trim();
}

export function filterStaffOrders(orders: StaffOrder[], status: StaffOrderFilter, search = '') {
  const query = normalizeStaffSearch(search).replace(/^#/, '');
  return orders.filter((order) => {
    if (status !== 'ALL' && order.status !== status) return false;
    const fields = [order.id, order.customerName, order.tableNumber === null ? '' : `bàn ${order.tableNumber}`];
    return !query || fields.some((field) => normalizeStaffSearch(field).includes(query));
  });
}

export function selectStaffOrder(visibleOrders: StaffOrder[], selectedId: string | null) {
  return visibleOrders.find((order) => order.id === selectedId) ?? visibleOrders[0];
}

export const formatStaffMoney = (amount: number) => new Intl.NumberFormat('vi-VN', {
  style: 'currency', currency: 'VND', maximumFractionDigits: 0,
}).format(amount);

export const formatStaffTime = (value: string) => new Intl.DateTimeFormat('vi-VN', {
  hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh',
}).format(new Date(value));
