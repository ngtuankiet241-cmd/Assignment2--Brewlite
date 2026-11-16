
'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getAuthSnapshot, parseAuthUser } from '@/lib/auth';

type OrderStatus =
  | 'PENDING'
  | 'PAYMENT_FAILED'
  | 'PAID'
  | 'CONFIRMED'
  | 'PREPARING'
  | 'READY'
  | 'COMPLETED'
  | 'CANCELLED';

interface OrderItem {
  id: string;
  productName: string;
  quantity: number;
  size?: string | null;
  itemTotal: number | string;
}

interface Order {
  id: string;
  customerName: string;
  customerPhone: string;
  tableNumber?: number | null;
  totalAmount: number | string;
  status: OrderStatus;
  createdAt: string;
  notes?: string | null;
  items: OrderItem[];
}

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

const statusLabels: Record<OrderStatus, string> = {
  PENDING: 'Chờ thanh toán',
  PAYMENT_FAILED: 'Thanh toán thất bại',
  PAID: 'Đã thanh toán',
  CONFIRMED: 'Đã xác nhận',
  PREPARING: 'Đang pha chế',
  READY: 'Sẵn sàng giao',
  COMPLETED: 'Hoàn thành',
  CANCELLED: 'Đã hủy',
};

const statusClasses: Record<OrderStatus, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  PAYMENT_FAILED: 'bg-red-100 text-red-800',
  PAID: 'bg-blue-100 text-blue-800',
  CONFIRMED: 'bg-indigo-100 text-indigo-800',
  PREPARING: 'bg-orange-100 text-orange-800',
  READY: 'bg-green-100 text-green-800',
  COMPLETED: 'bg-emerald-100 text-emerald-800',
  CANCELLED: 'bg-gray-100 text-gray-700',
};

function formatMoney(value: number | string) {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(Number(value));
}

function readToken() {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem('token');
  } catch {
    return null;
  }
}

export default function StaffOrdersClient() {
  const router = useRouter();

  const [orders, setOrders] = useState<Order[]>([]);
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [filter, setFilter] = useState('ALL');

  const loadOrders = useCallback(async (token: string) => {
    const response = await fetch(`${API_URL}/orders/staff`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new Error('Tài khoản không có quyền xem đơn hàng.');
      }
      throw new Error('Không thể tải danh sách đơn hàng.');
    }

    const data: unknown = await response.json();

    if (!Array.isArray(data)) {
      throw new Error('Dữ liệu đơn hàng không hợp lệ.');
    }

    setOrders(data as Order[]);
  }, []);

  useEffect(() => {
    let active = true;

    async function initialize() {
      const user = parseAuthUser(getAuthSnapshot());
      const token = readToken();

      if (!user || !token) {
        router.replace('/login');
        return;
      }

      if (user.role !== 'BARISTA' && user.role !== 'ADMIN') {
        router.replace('/menu');
        return;
      }

      if (!active) return;
      setAuthorized(true);

      try {
        await loadOrders(token);
      } catch (err) {
        if (active) {
          setError(
            err instanceof Error ? err.message : 'Đã xảy ra lỗi.',
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void initialize();

    return () => {
      active = false;
    };
  }, [router, loadOrders]);

  const updateOrder = async (
    order: Order,
    action: 'confirm' | 'reject' | 'status',
    nextStatus?: OrderStatus,
  ) => {
    const token = readToken();

    if (!token) {
      router.replace('/login');
      return;
    }

    if (action === 'reject') {
      const accepted = window.confirm(
        `Bạn có chắc muốn từ chối đơn ${order.id.slice(0, 8)}?`,
      );

      if (!accepted) return;
    }

    setProcessingId(order.id);
    setError('');
    setMessage('');

    try {
      const path =
        action === 'status'
          ? `${API_URL}/orders/${order.id}/status`
          : `${API_URL}/orders/${order.id}/${action}`;

      const response = await fetch(path, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        ...(action === 'status'
          ? { body: JSON.stringify({ status: nextStatus }) }
          : {}),
      });

      if (!response.ok) {
        const result = await response.json().catch(() => null);
        const detail = result?.message;

        throw new Error(
          typeof detail === 'string'
            ? detail
            : 'Không thể cập nhật đơn hàng.',
        );
      }

      setMessage('Cập nhật đơn hàng thành công.');
      await loadOrders(token);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Thao tác thất bại.',
      );
    } finally {
      setProcessingId(null);
    }
  };

  const visibleOrders = orders.filter(
    (order) => filter === 'ALL' || order.status === filter,
  );

  if (!authorized) {
    return (
      <main className="mx-auto max-w-6xl p-8">
        <p>Đang kiểm tra quyền truy cập...</p>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen max-w-7xl px-4 py-8 sm:px-6">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-coffee-950">
            Quản lý đơn hàng
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            Xác nhận đơn, pha chế và theo dõi tiến độ.
          </p>
        </div>

        <Link
          href="/menu"
          className="rounded-xl border px-4 py-2 text-sm font-semibold"
        >
          Về trang chủ
        </Link>
      </div>

      {error && (
        <div role="alert" className="mb-4 rounded-xl bg-red-50 p-4 text-red-700">
          {error}
        </div>
      )}

      {message && (
        <div role="status" className="mb-4 rounded-xl bg-green-50 p-4 text-green-700">
          {message}
        </div>
      )}

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          aria-label="Lọc trạng thái đơn hàng"
          className="rounded-xl border bg-white px-4 py-2"
        >
          <option value="ALL">Tất cả đơn hàng</option>
          {Object.entries(statusLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={async () => {
            const token = readToken();
            if (!token) return router.replace('/login');

            setLoading(true);
            setError('');

            try {
              await loadOrders(token);
            } catch (err) {
              setError(
                err instanceof Error ? err.message : 'Không thể tải dữ liệu.',
              );
            } finally {
              setLoading(false);
            }
          }}
          disabled={loading}
          className="rounded-xl bg-coffee-800 px-4 py-2 font-semibold text-white disabled:opacity-50"
        >
          Làm mới
        </button>

        <span className="text-sm text-gray-600">
          {visibleOrders.length} đơn hàng
        </span>
      </div>

      {loading ? (
        <p>Đang tải danh sách đơn hàng...</p>
      ) : visibleOrders.length === 0 ? (
        <div className="rounded-2xl border bg-white p-10 text-center text-gray-500">
          Chưa có đơn hàng nào.
        </div>
      ) : (
        <div className="grid gap-5">
          {visibleOrders.map((order) => {
            const busy = processingId === order.id;

            return (
              <article
                key={order.id}
                className="rounded-2xl border bg-white p-5 shadow-sm"
              >
                <div className="flex flex-wrap justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-bold text-coffee-950">
                      Đơn #{order.id.slice(0, 8)}
                    </h2>
                    <p className="text-sm text-gray-600">
                      {order.customerName} — {order.customerPhone}
                    </p>
                    <p className="mt-1 text-xs text-gray-500">
                      {new Date(order.createdAt).toLocaleString('vi-VN')}
                    </p>
                    {order.tableNumber != null && (
                      <p className="text-sm">
                        Bàn số: {order.tableNumber}
                      </p>
                    )}
                  </div>

                  <div className="text-right">
                    <span
                      className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${
                        statusClasses[order.status] || 'bg-gray-100'
                      }`}
                    >
                      {statusLabels[order.status] || order.status}
                    </span>
                    <p className="mt-3 text-xl font-bold text-coffee-950">
                      {formatMoney(order.totalAmount)}
                    </p>
                  </div>
                </div>

                <div className="my-5 border-t pt-4">
                  <h3 className="mb-2 font-semibold">Sản phẩm</h3>
                  {order.items.map((item) => (
                    <div
                      key={item.id}
                      className="flex justify-between gap-3 py-1 text-sm"
                    >
                      <span>
                        {item.productName} x{item.quantity}
                        {item.size ? ` — Size ${item.size}` : ''}
                      </span>
                      <span>{formatMoney(item.itemTotal)}</span>
                    </div>
                  ))}
                  {order.notes && (
                    <p className="mt-3 text-sm text-gray-600">
                      Ghi chú: {order.notes}
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  {order.status === 'PAID' && (
                    <button
                      disabled={busy}
                      onClick={() => updateOrder(order, 'confirm')}
                      className="rounded-xl bg-green-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                    >
                      Bắt đầu pha chế
                    </button>
                  )}

                  {order.status === 'CONFIRMED' && (
                    <button
                      disabled={busy}
                      onClick={() =>
                        updateOrder(order, 'status', 'PREPARING')
                      }
                      className="rounded-xl bg-coffee-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                    >
                      Bắt đầu pha chế
                    </button>
                  )}

                  {order.status === 'PREPARING' && (
                    <button
                      disabled={busy}
                      onClick={() =>
                        updateOrder(order, 'status', 'READY')
                      }
                      className="rounded-xl bg-coffee-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                    >
                      Pha chế xong
                    </button>
                  )}

                  {order.status === 'READY' && (
                    <button
                      disabled={busy}
                      onClick={() =>
                        updateOrder(order, 'status', 'COMPLETED')
                      }
                      className="rounded-xl bg-green-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                    >
                      Hoàn thành đơn
                    </button>
                  )}

                  {(order.status === 'PENDING' ||
                    order.status === 'PAYMENT_FAILED') && (
                    <button
                      disabled={busy}
                      onClick={() => updateOrder(order, 'reject')}
                      className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                    >
                      Từ chối đơn
                    </button>
                  )}

                  {busy && (
                    <span className="self-center text-sm text-gray-500">
                      Đang xử lý...
                    </span>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </main>
  );
}
