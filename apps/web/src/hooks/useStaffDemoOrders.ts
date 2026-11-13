'use client';

import { useCallback, useEffect, useState } from 'react';
import { loadStaffDemoOrders } from '@/data/staffDemoOrders';
import type { StaffDemoMode, StaffOrder } from '@/types/staff';

const initialState = { orders: [] as StaffOrder[], status: 'loading' as 'loading' | 'ready' | 'error', error: '', refreshedAt: null as string | null };

export function useStaffDemoOrders() {
  const [state, setState] = useState(initialState);
  const [mode, setMode] = useState<StaffDemoMode>('normal');
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    if (mode === 'loading') return;
    let ignore = false;
    async function load() {
      try {
        const orders = await loadStaffDemoOrders(mode);
        if (!ignore) setState({ orders, status: 'ready', error: '', refreshedAt: new Date().toISOString() });
      } catch (error) {
        if (!ignore) setState({ orders: [], status: 'error', error: error instanceof Error ? error.message : 'Không thể tải dữ liệu demo.', refreshedAt: null });
      }
    }
    void load();
    return () => { ignore = true; };
  }, [mode, revision]);

  const changeMode = useCallback((next: StaffDemoMode) => {
    setState(initialState);
    setMode(next);
    setRevision((value) => value + 1);
  }, []);
  const refresh = useCallback(() => changeMode('normal'), [changeMode]);

  return { ...state, mode, changeMode, refresh };
}
