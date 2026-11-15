'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { getAuthToken } from '@/lib/auth';
import { LOYALTY_CHANGED, requestLoyaltyAccount, type LoyaltyAccount } from '@/lib/loyalty';

type State = { userId: string } & (
  | { status: 'success'; account: LoyaltyAccount }
  | { status: 'error'; message: string }
);

export function useLoyaltyAccount(apiUrl: string) {
  const { user } = useAuth();
  const userId = user?.id;
  const [state, setState] = useState<State | null>(null);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    if (!userId) return;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      controller.abort();
      setState({ userId, status: 'error', message: 'Tải điểm quá lâu. Vui lòng thử lại.' });
    }, 10000);
    async function load() {
      try {
        const account = await requestLoyaltyAccount(apiUrl, getAuthToken() ?? '', controller.signal);
        if (!controller.signal.aborted) setState({ userId: userId!, status: 'success', account });
      } catch (error) {
        if (!controller.signal.aborted) setState({ userId: userId!, status: 'error',
          message: error instanceof TypeError ? 'Chưa kết nối được để tải điểm. Vui lòng thử lại.'
            : error instanceof Error ? error.message : 'Không tải được điểm. Vui lòng thử lại.' });
      } finally { window.clearTimeout(timeout); }
    }
    void load();
    return () => { controller.abort(); window.clearTimeout(timeout); };
  }, [apiUrl, userId, revision]);

  useEffect(() => {
    if (!userId) return;
    const refresh = () => setRevision((value) => value + 1);
    const onStorage = (event: StorageEvent) => { if (event.key === LOYALTY_CHANGED) refresh(); };
    window.addEventListener('focus', refresh);
    window.addEventListener(LOYALTY_CHANGED, refresh);
    window.addEventListener('storage', onStorage);
    const timer = window.setInterval(refresh, 30000);
    return () => {
      window.removeEventListener('focus', refresh);
      window.removeEventListener(LOYALTY_CHANGED, refresh);
      window.removeEventListener('storage', onStorage);
      window.clearInterval(timer);
    };
  }, [userId]);

  const current = state?.userId === userId ? state : null;
  return {
    userId,
    account: current?.status === 'success' ? current.account : null,
    loading: Boolean(userId && !current),
    error: current?.status === 'error' ? current.message : null,
    refresh: () => { setState(null); setRevision((value) => value + 1); },
  };
}
