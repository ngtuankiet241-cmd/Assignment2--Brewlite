'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { requestLoyaltyAccount, type LoyaltyAccount } from '@/lib/loyalty';
import LoyaltyCard from './LoyaltyCard';

type State = { userId: string } & (
  | { status: 'loading' }
  | { status: 'success'; account: LoyaltyAccount }
  | { status: 'error'; message: string }
);

export default function LoyaltyPanel({ apiUrl }: { apiUrl: string }) {
  const { user } = useAuth();
  const userId = user?.id;
  const [state, setState] = useState<State | null>(null);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    if (!userId) return;
    const ownerId = userId;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      controller.abort();
      setState({ userId: ownerId, status: 'error', message: 'Tải điểm thưởng quá lâu. Vui lòng thử lại.' });
    }, 10000);
    async function load() {
      try {
        const token = localStorage.getItem('token') ?? '';
        const account = await requestLoyaltyAccount(apiUrl, token, controller.signal);
        if (!controller.signal.aborted) setState({ userId: ownerId, status: 'success', account });
      } catch (error: unknown) {
        if (!controller.signal.aborted) setState({
          userId: ownerId, status: 'error',
          message: error instanceof TypeError ? 'Không thể kết nối để tải điểm thưởng. Vui lòng thử lại.'
            : error instanceof Error ? error.message : 'Không tải được điểm thưởng. Vui lòng thử lại.',
        });
      } finally { window.clearTimeout(timeout); }
    }
    void load();
    const refreshOnFocus = () => {
      setState({ userId, status: 'loading' });
      setRevision((value) => value + 1);
    };
    window.addEventListener('focus', refreshOnFocus);
    return () => {
      controller.abort();
      window.clearTimeout(timeout);
      window.removeEventListener('focus', refreshOnFocus);
    };
  }, [apiUrl, userId, revision]);

  if (!userId) return null;
  // Never display a previous account's balance during an account switch.
  const current = state?.userId === userId ? state : null;
  const loading = !current || current.status === 'loading';
  return (
    <section aria-label="Điểm thưởng của bạn" className="mb-6 rounded-2xl border border-coffee-200 bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-base font-bold text-coffee-950">Điểm thưởng của bạn</h2>
        <button
          className="min-h-10 rounded-full border border-coffee-200 px-3 text-xs font-semibold text-coffee-800 disabled:opacity-50"
          disabled={loading}
          onClick={() => {
            setState({ userId, status: 'loading' });
            setRevision((value) => value + 1);
          }}
          type="button"
        >
          Cập nhật điểm
        </button>
      </div>
      {loading && <p className="text-sm text-coffee-600" role="status">Đang tải điểm thưởng...</p>}
      {current?.status === 'error' && <p className="text-sm text-red-700" role="alert">{current.message}</p>}
      {current?.status === 'success' && <LoyaltyCard account={current.account} />}
    </section>
  );
}
