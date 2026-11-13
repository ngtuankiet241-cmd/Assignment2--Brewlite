'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { saveAuthSession } from '@/lib/auth';

export default function LoginPageClient() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError('Vui lòng nhập đầy đủ email và mật khẩu.');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const res = await fetch(`${apiUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.message || 'Email hoặc mật khẩu không đúng.');
      }

      const data = await res.json();
      saveAuthSession(data);

      router.replace('/menu');
    } catch (err: unknown) {
      const message = err instanceof TypeError
        ? 'Không thể kết nối đến máy chủ. Vui lòng kiểm tra kết nối và thử lại.'
        : err instanceof Error ? err.message : 'Đăng nhập thất bại. Vui lòng thử lại.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="mx-auto w-full max-w-md flex-1 px-4 py-16 sm:px-6">
      <div className="rounded-3xl border border-coffee-200 bg-white p-8 shadow-lg">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-coffee-800 text-cream-50">
            <svg className="h-7 w-7 fill-current" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path d="M2 19h18a1 1 0 0 0 1-1v-1H2v1a1 1 0 0 0 1 1zm18-14H4v8a4 4 0 0 0 4 4h4a4 4 0 0 0 4-4v-1h2a3 3 0 0 0 3-3V8a3 3 0 0 0-3-3zm1 3a1 1 0 0 1-1 1h-2V7h2a1 1 0 0 1 1 1z" />
            </svg>
          </div>
          <h1 className="mt-4 text-2xl font-black text-coffee-950">Đăng nhập BrewLite</h1>
          <p className="mt-1 text-sm text-coffee-600">Chào mừng bạn quay lại! ☕</p>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-700" role="alert">
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-bold text-coffee-800" htmlFor="email">
              Email <span className="text-red-500">*</span>
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Ví dụ: nguyen@email.com"
              className="mt-1.5 w-full rounded-xl border border-coffee-200 bg-cream-50/50 px-3.5 py-2.5 text-sm text-coffee-950 placeholder-coffee-400 focus:border-coffee-500 focus:bg-white focus:outline-hidden"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-coffee-800" htmlFor="password">
              Mật khẩu <span className="text-red-500">*</span>
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Nhập mật khẩu"
              className="mt-1.5 w-full rounded-xl border border-coffee-200 bg-cream-50/50 px-3.5 py-2.5 text-sm text-coffee-950 placeholder-coffee-400 focus:border-coffee-500 focus:bg-white focus:outline-hidden"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="mt-2 flex min-h-12 w-full items-center justify-center rounded-full bg-coffee-800 px-4 text-sm font-bold text-white shadow-sm transition hover:bg-coffee-700 active:scale-[0.98] disabled:opacity-50"
          >
            {loading ? 'Đang đăng nhập...' : 'Đăng nhập →'}
          </button>
        </form>

        {/* Footer links */}
        <div className="mt-6 text-center text-xs text-coffee-600">
          Chưa có tài khoản?{' '}
          <Link href="/register" className="font-bold text-coffee-800 hover:underline">
            Đăng ký ngay
          </Link>
        </div>
        <div className="mt-3 text-center">
          <Link href="/menu" className="text-xs text-coffee-500 hover:text-coffee-700">
            ← Quay lại thực đơn
          </Link>
        </div>
      </div>
    </main>
  );
}

