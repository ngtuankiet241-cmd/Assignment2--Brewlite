'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { clearAuthSession, getAuthTokenSnapshot } from '@/lib/auth';

// /orders/history currently exposes system-wide orders. Do not call it here.
// Only validate the session with the existing protected endpoint.
function VerifiedHistoryNotice({ token }: { token: string }) {
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [attempt, setAttempt] = useState(0);
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

  useEffect(() => {
    let ignore = false;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    async function verifySession() {
      try {
        const response = await fetch(`${apiUrl}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store',
          signal: controller.signal,
        });
        if (ignore || getAuthTokenSnapshot() !== token) return;
        if (response.status === 401) {
          clearAuthSession();
          return;
        }
        if (!response.ok) throw new Error('Session verification failed');
        setStatus('ready');
      } catch {
        if (!ignore && getAuthTokenSnapshot() === token) setStatus('error');
      } finally {
        clearTimeout(timeout);
      }
    }

    void verifySession();
    return () => {
      ignore = true;
      clearTimeout(timeout);
      controller.abort();
    };
  }, [apiUrl, token, attempt]);

  if (status === 'loading') {
    return (
      <div role="status" aria-busy="true" className="py-12 text-center text-sm text-coffee-600">
        Đang kiểm tra phiên đăng nhập...
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center text-sm text-red-700">
        <p>Không thể kiểm tra phiên đăng nhập. Vui lòng kiểm tra kết nối và thử lại.</p>
        <button
          type="button"
          className="mt-4 min-h-11 rounded-full bg-coffee-800 px-6 font-bold text-white hover:bg-coffee-700"
          onClick={() => { setStatus('loading'); setAttempt((value) => value + 1); }}
        >
          Thử lại
        </button>
      </div>
    );
  }

  return (
    <div role="status" className="rounded-3xl border border-coffee-200 bg-white p-8 text-center shadow-sm sm:p-12">
      <div aria-hidden="true" className="text-5xl">☕</div>
      <h2 className="mt-4 text-lg font-bold text-coffee-950">Lịch sử đơn hàng đang được hoàn thiện</h2>
      <p className="mt-2 text-sm text-coffee-600">Bạn có thể tiếp tục chọn đồ uống trong thực đơn.</p>
      <Link href="/menu" className="mt-6 inline-flex min-h-11 items-center justify-center rounded-full bg-coffee-800 px-6 text-sm font-bold text-white hover:bg-coffee-700">
        Xem thực đơn →
      </Link>
    </div>
  );
}

export default function OrdersPageClient() {
  const { user, token } = useAuth();

  if (!user || !token) {
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

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6">
      <h1 className="mb-6 text-2xl font-black text-coffee-950 sm:text-3xl">Đơn của tôi</h1>
      {/* A new session unmounts the old request and resets all request state. */}
      <VerifiedHistoryNotice key={token} token={token} />
    </main>
  );
}
