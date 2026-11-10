'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface OrderItem {
  id: string;
  productName: string;
  quantity: number;
  size: string;
  toppings?: string;
  itemTotal: number;
}

interface Order {
  id: string;
  status: string;
  totalAmount: number;
  customerName: string;
  customerPhone: string;
  tableNumber?: number;
  notes?: string;
  createdAt: string;
  items: OrderItem[];
}

const STATUS_STEPS = ['PENDING', 'PAID', 'PREPARING', 'READY', 'COMPLETED'];

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'Chờ thanh toán',
  PAID: 'Đã thanh toán',
  PREPARING: 'Đang pha chế',
  READY: 'Sẵn sàng nhận',
  COMPLETED: 'Hoàn tất',
};

const STATUS_COLOR: Record<string, string> = {
  PENDING: 'bg-gray-100 text-gray-700',
  PAID: 'bg-amber-100 text-amber-800',
  PREPARING: 'bg-orange-100 text-orange-800',
  READY: 'bg-blue-100 text-blue-800',
  COMPLETED: 'bg-emerald-100 text-emerald-800',
};

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
}

function formatDate(dateStr: string) {
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(dateStr));
}

function OrderStatusBar({ status }: { status: string }) {
  const currentIndex = STATUS_STEPS.indexOf(status);
  return (
    <div className="mt-3">
      <div className="flex items-center gap-0">
        {STATUS_STEPS.map((step, idx) => {
          const isDone = idx <= currentIndex;
          const isActive = idx === currentIndex;
          return (
            <div key={step} className="flex flex-1 items-center">
              <div className="flex flex-col items-center">
                <div
                  className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold transition-colors ${
                    isDone
                      ? isActive
                        ? 'bg-coffee-800 text-white ring-2 ring-coffee-300'
                        : 'bg-coffee-600 text-white'
                      : 'bg-gray-200 text-gray-400'
                  }`}
                >
                  {isDone && !isActive ? '✓' : idx + 1}
                </div>
                <span className={`mt-1 text-center text-[9px] font-semibold leading-tight ${isDone ? 'text-coffee-800' : 'text-gray-400'}`}>
                  {STATUS_LABEL[step]}
                </span>
              </div>
              {idx < STATUS_STEPS.length - 1 && (
                <div className={`h-0.5 flex-1 transition-colors ${idx < currentIndex ? 'bg-coffee-600' : 'bg-gray-200'}`} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function OrdersPageClient() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      setTimeout(() => {
        setLoading(false);
      }, 0);
      return;
    }

    setTimeout(() => {
      setIsLoggedIn(true);
    }, 0);

    fetch(`${apiUrl}/orders/history`, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    })
      .then(async (res) => {
        if (!res.ok) {
          if (res.status === 401) {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            setIsLoggedIn(false);
            return;
          }
          throw new Error(`Lỗi ${res.status}: Không thể tải lịch sử đơn hàng.`);
        }
        const data: Order[] = await res.json();
        setOrders(data);
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : 'Lỗi không xác định.';
        setError(message);
      })
      .finally(() => setLoading(false));
  }, [apiUrl]);

  // Chưa đăng nhập
  if (!loading && !isLoggedIn) {
    return (
      <main className="mx-auto w-full max-w-lg flex-1 px-4 py-20 text-center">
        <div className="rounded-3xl border border-coffee-200 bg-white p-10 shadow-lg">
          <div className="text-5xl">🔒</div>
          <h1 className="mt-4 text-xl font-black text-coffee-950">Vui lòng đăng nhập</h1>
          <p className="mt-2 text-sm text-coffee-600">
            Bạn cần đăng nhập để xem lịch sử và theo dõi trạng thái đơn hàng.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/login"
              className="inline-flex min-h-11 items-center justify-center rounded-full bg-coffee-800 px-6 text-sm font-bold text-white transition hover:bg-coffee-700"
            >
              Đăng nhập
            </Link>
            <Link
              href="/register"
              className="inline-flex min-h-11 items-center justify-center rounded-full border border-coffee-300 px-6 text-sm font-semibold text-coffee-800 transition hover:bg-cream-100"
            >
              Đăng ký tài khoản
            </Link>
          </div>
        </div>
      </main>
    );
  }

  // Đang tải
  if (loading) {
    return (
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-16 text-center text-sm text-coffee-600">
        Đang tải lịch sử đơn hàng...
      </main>
    );
  }

  // Lỗi
  if (error) {
    return (
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-16 text-center">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">{error}</div>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6">
      <div className="mb-6">
        <h1 className="text-2xl font-black text-coffee-950 sm:text-3xl">Lịch sử & Trạng thái Đơn hàng</h1>
        <p className="mt-1 text-sm text-coffee-600">Theo dõi tiến độ pha chế và toàn bộ đơn đã đặt.</p>
      </div>

      {orders.length === 0 ? (
        <div className="rounded-3xl border border-coffee-200 bg-white p-12 text-center shadow-sm">
          <div className="text-5xl">☕</div>
          <h2 className="mt-4 text-lg font-bold text-coffee-950">Chưa có đơn hàng nào</h2>
          <p className="mt-1 text-sm text-coffee-600">Hãy ghé thực đơn và đặt ly đầu tiên nhé!</p>
          <Link
            href="/menu"
            className="mt-6 inline-flex min-h-11 items-center justify-center rounded-full bg-coffee-800 px-6 text-sm font-bold text-white transition hover:bg-coffee-700"
          >
            Xem thực đơn →
          </Link>
        </div>
      ) : (
        <div className="space-y-5">
          {orders.map((order) => (
            <div
              key={order.id}
              className="rounded-2xl border border-coffee-200/80 bg-white p-5 shadow-sm sm:p-6"
            >
              {/* Header đơn */}
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <span className="font-mono text-xs font-semibold text-coffee-500">#{order.id.slice(-8).toUpperCase()}</span>
                  <p className="text-xs text-coffee-500">{formatDate(order.createdAt)}</p>
                </div>
                <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold ${STATUS_COLOR[order.status] || 'bg-gray-100 text-gray-700'}`}>
                  {STATUS_LABEL[order.status] || order.status}
                </span>
              </div>

              {/* Thanh tiến trình trạng thái */}
              <OrderStatusBar status={order.status} />

              {/* Danh sách món */}
              <div className="mt-4 divide-y divide-coffee-100">
                {order.items.map((item) => (
                  <div key={item.id} className="flex justify-between py-2 text-sm">
                    <div>
                      <span className="font-semibold text-coffee-950">
                        {item.quantity}× {item.productName}
                      </span>
                      <span className="ml-1 text-coffee-500">(Size {item.size})</span>
                      {item.toppings && (
                        <p className="text-xs text-coffee-400">+ {item.toppings}</p>
                      )}
                    </div>
                    <span className="font-bold text-coffee-900 shrink-0">{formatCurrency(item.itemTotal)}</span>
                  </div>
                ))}
              </div>

              {/* Tổng + thông tin khách */}
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-coffee-200/70 pt-3">
                <div className="text-xs text-coffee-600">
                  <span className="font-semibold text-coffee-800">{order.customerName}</span>
                  {' · '}
                  {order.customerPhone}
                  {order.tableNumber && ` · Bàn #${order.tableNumber}`}
                </div>
                <span className="text-base font-black text-coffee-900">{formatCurrency(order.totalAmount)}</span>
              </div>

              {order.notes && (
                <p className="mt-2 text-xs italic text-coffee-500">📝 {order.notes}</p>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="mt-8 text-center">
        <Link href="/menu" className="text-xs font-semibold text-coffee-600 hover:text-coffee-900">
          ← Tiếp tục đặt món
        </Link>
      </div>
    </main>
  );
}

