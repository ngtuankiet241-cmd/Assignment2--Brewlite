'use client';

import { useMemo, useSyncExternalStore } from 'react';
import { clearAuthSession, getAuthSnapshot, getAuthTokenSnapshot, parseAuthUser, subscribeAuthChanges } from '@/lib/auth';

const serverSnapshot = () => null;

export function useAuth() {
  const snapshot = useSyncExternalStore(subscribeAuthChanges, getAuthSnapshot, serverSnapshot);
  const token = useSyncExternalStore(subscribeAuthChanges, getAuthTokenSnapshot, serverSnapshot);
  const user = useMemo(() => parseAuthUser(snapshot), [snapshot]);
  return { user, token, logout: clearAuthSession };
}
