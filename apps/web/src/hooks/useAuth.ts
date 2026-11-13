'use client';

import { useMemo, useSyncExternalStore } from 'react';
import { clearAuthSession, getAuthSnapshot, parseAuthUser, subscribeAuthChanges } from '@/lib/auth';

const serverSnapshot = () => null;

export function useAuth() {
  const snapshot = useSyncExternalStore(subscribeAuthChanges, getAuthSnapshot, serverSnapshot);
  const user = useMemo(() => parseAuthUser(snapshot), [snapshot]);
  return { user, logout: clearAuthSession };
}
