'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useCart } from '@/context/useCart';

type PaymentState = 'LOADING' | 'SUCCESS' | 'PENDING' | 'FAILED';

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function PaymentResultClient() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get('orderId');
  const { clearCart, hydrated } = useCart();

  const [state, setState] = useState<PaymentState>('LOADING');
  const [message, setMessage] = useState('');

  useEffect(() => {
    // Missing orderId is handled while rendering, not with setState in an effect.
    if (!orderId) return;

    let cancelled = false;
    let attempts = 0;

    async function checkPayment() {
      if (cancelled) return;

      try {
        const res = await fetch(
          `${API_URL}/orders/${encodeURIComponent(orderId!)}/status`,
          { cache: 'no-store' },
        );

        if (!res.ok) throw new Error('Không thể kiểm tra trạng thái đơn.');

        const order = await res.json();
        if (cancelled) return;

        if (
          ['PAID', 'CONFIRMED', 'PREPARING', 'READY', 'COMPLETED'].includes(
            order.status,
          )
        ) {
          setState('SUCCESS');
          setMessage('Thanh toán thành công!');
          return;
        }

        if (order.status === 'PAYMENT_FAILED') {
          setState('FAILED');
          setMessage('Quý khách chưa thanh toán thành công.');
          return;
        }

        if (order.status === 'CANCELLED') {
          setState('FAILED');
          setMessage('Đơn hàng đã bị hủy.');
          return;
        }

        setState('PENDING');
        setMessage('Đang chờ SePay xác nhận thanh toán.');
      } catch {
        if (!cancelled) {
          setState('PENDING');
          setMessage('Chưa thể kiểm tra thanh toán. Vui lòng thử lại.');
        }
      }
    }

    void checkPayment();
    const interval = window.setInterval(() => {
      if (attempts >= 12) {
        window.clearInterval(interval);
        return;
      }

      attempts++;
      void checkPayment();
    }, 5000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [orderId]);

  useEffect(() => {
    if (!hydrated || state !== 'SUCCESS' || !orderId) return;

    const pendingOrderId = sessionStorage.getItem(
      'brewlite-pending-cart-order',
    );
    // Chỉ xóa giỏ hàng của đơn vừa được tạo từ checkout.
    if (pendingOrderId === orderId) {
      clearCart();
      sessionStorage.removeItem('brewlite-pending-cart-order');
    }
  }, [hydrated, state, orderId, clearCart]);

  const displayState: PaymentState = orderId ? state : 'FAILED';
  const displayMessage = orderId ? message : 'Không tìm thấy mã đơn hàng.';
  const success = displayState === 'SUCCESS';
  const failed = displayState === 'FAILED';

  return (
    <main className="mx-auto flex min-h-[65vh] max-w-xl items-center px-4 py-12">
      <section className="w-full rounded-3xl border border-coffee-200 bg-white p-8 text-center shadow-md">
        <div className="mb-4 text-5xl">
          {success ? '✅' : failed ? '❌' : '⏳'}
        </div>

        <h1 className="text-2xl font-black text-coffee-950">
          {displayState === 'LOADING'
            ? 'Đang kiểm tra thanh toán'
            : success
              ? 'Thanh toán thành công'
              : failed
                ? 'Thanh toán chưa thành công'
                : 'Đang chờ thanh toán'}
        </h1>

        <p className="mt-3 text-sm text-coffee-600">{displayMessage}</p>
        {orderId && (
          <p className="mt-4 break-all text-xs text-coffee-500">
            Mã đơn hàng: {orderId}
          </p>
        )}
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            href="/orders"
            className="rounded-full bg-coffee-800 px-6 py-3 text-sm font-bold text-white"
          >
            Xem đơn hàng
          </Link>
          <Link
            href="/menu"
            className="rounded-full border border-coffee-300 px-6 py-3 text-sm font-bold text-coffee-800"
          >
            Về thực đơn
          </Link>
        </div>
      </section>
    </main>
  );
}
