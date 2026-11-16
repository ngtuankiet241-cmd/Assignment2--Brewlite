'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { clearAuthSession } from '@/lib/auth';
import { createStaffApiClient, StaffApiError } from '@/services/staffApiClient';
import { filterStaffOrders, selectStaffOrder, STAFF_NEXT_ACTION, type StaffOrderDetails, type StaffOrderFilter, type StaffOrdersPage, type StaffUpdateStatusInput } from '@/types/staff';

const PAGE_SIZE = 10;

function client() {
  return createStaffApiClient({
    baseUrl: process.env.NEXT_PUBLIC_API_URL ?? '',
    getAccessToken: () => {
      try { return window.localStorage.getItem('token'); } catch { return null; }
    },
    allowStatusUpdates: true,
  });
}

function useStaffResource<T>(key: string | null, read: (signal: AbortSignal) => Promise<T>, onAccessError: (error: StaffApiError) => void) {
  const [result, setResult] = useState<{ key: string; data?: T; error?: StaffApiError; refreshedAt?: string } | null>(null);

  useEffect(() => {
    if (key === null) return;
    const controller = new AbortController();
    let active = true;
    async function load() {
      try {
        const data = await read(controller.signal);
        if (active && !controller.signal.aborted) setResult({ key: key!, data, refreshedAt: new Date().toISOString() });
      } catch (cause) {
        if (!active || controller.signal.aborted) return;
        const error = cause instanceof StaffApiError ? cause : new StaffApiError('NETWORK', 'Không thể tải dữ liệu Staff. Vui lòng thử lại.');
        if (error.code === 'ABORTED') return;
        setResult({ key: key!, error });
        if (error.code === 'UNAUTHENTICATED' || error.code === 'FORBIDDEN') onAccessError(error);
      }
    }
    void load();
    return () => { active = false; controller.abort(); };
  }, [key, read, onAccessError]);

  // Hide the old response immediately, before effect cleanup runs after a key change.
  const current = key !== null && result?.key === key ? result : null;
  return {
    data: current?.data,
    error: current?.error,
    refreshedAt: current?.refreshedAt,
    status: key === null ? 'idle' as const : current?.error ? 'error' as const : current?.data !== undefined ? 'ready' as const : 'loading' as const,
  };
}

export function useStaffOrders() {
  const [filter, setFilter] = useState<StaffOrderFilter>('ALL');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [preferredId, setPreferredId] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const [detailRevision, setDetailRevision] = useState(0);
  const [accessError, setAccessError] = useState<StaffApiError | null>(null);
  const [mutation, setMutation] = useState<{ pending: boolean; error: string } | null>(null);
  const pendingUpdate = useRef<AbortController | null>(null);
  useEffect(() => () => pendingUpdate.current?.abort(), []);
  const onAccessError = useCallback((error: StaffApiError) => {
    setAccessError(error);
    if (error.code === 'UNAUTHENTICATED') clearAuthSession();
  }, []);

  const listKey = `${filter}:${page}:${revision}`;
  const readList = useCallback((signal: AbortSignal) => client().listOrders({
    ...(filter === 'ALL' ? {} : { status: filter }), page, limit: PAGE_SIZE,
  }, { signal }), [filter, page]);
  const list = useStaffResource<StaffOrdersPage>(accessError ? null : listKey, readList, onAccessError);
  const orders = list.data?.data ?? [];
  const visibleOrders = filterStaffOrders(orders, 'ALL', search);
  const selected = selectStaffOrder(visibleOrders, preferredId);
  const selectedId = selected?.id;
  const readDetail = useCallback((signal: AbortSignal) => client().getOrder(selectedId!, { signal }), [selectedId]);
  const detail = useStaffResource<StaffOrderDetails>(
    !accessError && selectedId ? `${listKey}:${selectedId}:${detailRevision}` : null,
    readDetail, onAccessError,
  );

  async function updateSelectedOrder(nextStatus: StaffUpdateStatusInput['status']) {
    if (pendingUpdate.current || accessError || !selectedId || detail.status !== 'ready' ||
        detail.data?.id !== selectedId) return;
    const canCancel = nextStatus === 'CANCELLED' && ['PENDING', 'PAYMENT_FAILED', 'PAID', 'CONFIRMED'].includes(detail.data.status);
    if (!canCancel && STAFF_NEXT_ACTION[detail.data.status]?.status !== nextStatus) return;
    const controller = new AbortController();
    pendingUpdate.current = controller;
    setMutation({ pending: true, error: '' });
    try {
      await client().updateOrderStatus(selectedId, { status: nextStatus }, { signal: controller.signal });
      if (!controller.signal.aborted) {
        setMutation({ pending: false, error: '' });
        setRevision((value) => value + 1);
      }
    } catch (cause) {
      if (controller.signal.aborted) return;
      const error = cause instanceof StaffApiError ? cause : new StaffApiError('NETWORK', 'Không thể cập nhật đơn hàng. Vui lòng thử lại.');
      setMutation({ pending: false, error: error.message });
      if (error.code === 'UNAUTHENTICATED' || error.code === 'FORBIDDEN') onAccessError(error);
      else if (error.code === 'CONFLICT' || error.code === 'NOT_FOUND') setRevision((value) => value + 1);
    } finally {
      if (pendingUpdate.current === controller) pendingUpdate.current = null;
    }
  }

  return {
    orders, visibleOrders, selectedId, detail,
    updating: mutation?.pending ?? false,
    updateError: mutation?.error ?? '',
    updateSelectedOrder,
    status: accessError ? 'error' as const : list.status,
    error: accessError?.message ?? list.error?.message ?? '',
    errorCode: accessError?.code ?? list.error?.code,
    refreshedAt: list.refreshedAt,
    pagination: list.data?.pagination,
    filter, page, search,
    changeFilter(next: StaffOrderFilter) {
      if (next === filter && page === 1) return;
      setFilter(next); setPage(1); setPreferredId(null); setRevision((value) => value + 1);
    },
    changePage(next: number) {
      if (Number.isSafeInteger(next) && next >= 1) {
        setPage(Math.min(next, Math.max(1, list.data?.pagination.totalPages ?? 1)));
        setPreferredId(null); setRevision((value) => value + 1);
      }
    },
    changeSearch(next: string) { setSearch(next); setPreferredId(null); },
    selectOrder(id: string) { if (id !== selectedId && visibleOrders.some((order) => order.id === id)) { setPreferredId(id); setDetailRevision((value) => value + 1); } },
    resetFilters() { setFilter('ALL'); setSearch(''); setPage(1); setPreferredId(null); setRevision((value) => value + 1); },
    refresh() { setAccessError(null); setRevision((value) => value + 1); },
    retryDetail() { setDetailRevision((value) => value + 1); },
  };
}
