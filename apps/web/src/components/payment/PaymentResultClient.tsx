'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useCart } from '@/context/useCart';
import { clearCheckoutAttempt } from '@/lib/checkout-idempotency';
import { notifyLoyaltyChanged } from '@/lib/loyalty';
import { getAuthToken } from '@/lib/auth';
import { requestPaymentStatus } from '@/lib/payment-status';

type PaymentState = 'LOADING' | 'SUCCESS' | 'PENDING' | 'FAILED';

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function PaymentResultClient() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get('orderId');
  const { clearCart, hydrated } = useCart();

  const [result, setResult] = useState<{ orderId: string; state: PaymentState; message: string } | null>(null);
  const [revision, setRevision] = useState(0);
  const current = result?.orderId === orderId ? result : null;
  const state = current?.state ?? 'LOADING';
  const message = current?.message ?? '';

  useEffect(() => {
    // Missing orderId is handled while rendering, not with setState in an effect.
    if (!orderId) return;

    let cancelled = false;
    let timer: number | undefined;
    let requestTimeout: number | undefined;
    let activeRequest: AbortController | undefined;

    async function checkPayment() {
      if (cancelled) return;
      const controller = new AbortController();
      activeRequest = controller;
      requestTimeout = window.setTimeout(() => controller.abort(), 10000);
      let terminal = false;

      try {
        const status = await requestPaymentStatus(API_URL, orderId!, getAuthToken(), controller.signal);
        if (cancelled || controller.signal.aborted) return;

        if (
          ['PAID', 'CONFIRMED', 'PREPARING', 'READY', 'COMPLETED'].includes(
            status,
          )
        ) {
          terminal = true;
          setResult({ orderId: orderId!, state: 'SUCCESS', message: 'Thanh toán thành công!' });
        } else if (status === 'PAYMENT_FAILED' || status === 'CANCELLED') {
          terminal = true;
          setResult({ orderId: orderId!, state: 'FAILED', message: status === 'CANCELLED' ? 'Đơn hàng đã bị hủy.' : 'Quý khách chưa thanh toán thành công.' });
        } else {
          setResult({ orderId: orderId!, state: 'PENDING', message: 'Đang đối chiếu thanh toán với SePay. Trang sẽ tự cập nhật khi có xác nhận.' });
        }
      } catch (error) {
        if (!cancelled) {
          setResult({ orderId: orderId!, state: 'PENDING', message: error instanceof Error && error.name !== 'AbortError'
            ? error.message : 'Kiểm tra thanh toán quá lâu. Vui lòng thử lại.' });
        }
      } finally {
        window.clearTimeout(requestTimeout);
        // Schedule only after the request finishes; never overlap requests or
        // downgrade a confirmed payment with a late polling response.
        if (!cancelled && !terminal) timer = window.setTimeout(() => void checkPayment(), 5000);
      }
    }

    void checkPayment();

    return () => {
      cancelled = true;
      activeRequest?.abort();
      window.clearTimeout(timer);
      window.clearTimeout(requestTimeout);
    };
  }, [orderId, revision]);

  useEffect(() => {
    if (!hydrated || state !== 'SUCCESS' || !orderId) return;
    notifyLoyaltyChanged();

    const pendingOrderId = sessionStorage.getItem(
      'brewlite-pending-cart-order',
    );
    // Chỉ xóa giỏ hàng của đơn vừa được tạo từ checkout.
    if (pendingOrderId === orderId) {
      clearCart();
      clearCheckoutAttempt();
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
          {orderId && !success && (
            <button
              type="button"
              disabled={displayState === 'LOADING'}
              onClick={() => {
                setResult({ orderId, state: 'LOADING', message: '' });
                setRevision((value) => value + 1);
              }}
              className="min-h-11 rounded-full border border-coffee-300 px-6 py-3 text-sm font-bold text-coffee-800 transition hover:bg-coffee-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coffee-600 focus-visible:ring-offset-2 disabled:opacity-50"
            >
              {displayState === 'LOADING' ? 'Đang kiểm tra...' : 'Kiểm tra lại thanh toán'}
            </button>
          )}
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
