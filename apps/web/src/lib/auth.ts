export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  role?: string;
}

const AUTH_CHANGED = 'brewlite:auth-changed';

export function parseAuthUser(snapshot: string | null): AuthUser | null {
  try {
    const user = JSON.parse(snapshot || 'null');
    return user && typeof user.id === 'string' && typeof user.email === 'string' &&
      typeof user.fullName === 'string' && user.fullName.trim() ? user : null;
  } catch {
    return null;
  }
}

function tokenExpiresAt(token: string | null): number {
  try {
    const parts = token?.split('.');
    if (parts?.length !== 3) return 0;
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    return typeof payload.exp === 'number' && Number.isFinite(payload.exp) ? payload.exp * 1000 : 0;
  } catch {
    return 0;
  }
}

// A stable string snapshot lets React observe the existing localStorage session.
// Token verification and access control still belong to the API.
export function getAuthSnapshot(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    if (tokenExpiresAt(window.localStorage.getItem('token')) <= Date.now()) return null;
    const snapshot = window.localStorage.getItem('user');
    return parseAuthUser(snapshot) ? snapshot : null;
  } catch {
    return null;
  }
}

// Observe token rotation as well as user changes, without exposing expired sessions.
export function getAuthTokenSnapshot(): string | null {
  if (!getAuthSnapshot()) return null;
  try {
    return window.localStorage.getItem('token');
  } catch {
    return null;
  }
}

export function saveAuthSession(session: { accessToken: string; user: AuthUser }) {
  if (typeof session?.accessToken !== 'string' || tokenExpiresAt(session.accessToken) <= Date.now() ||
      !parseAuthUser(JSON.stringify(session.user))) {
    throw new Error('Thông tin đăng nhập trả về không hợp lệ. Vui lòng thử lại.');
  }
  try {
    window.localStorage.setItem('token', session.accessToken);
    window.localStorage.setItem('user', JSON.stringify(session.user));
  } catch {
    throw new Error('Không thể lưu phiên đăng nhập trên trình duyệt. Vui lòng cho phép lưu dữ liệu và thử lại.');
  }
  window.dispatchEvent(new Event(AUTH_CHANGED));
}

export function clearAuthSession() {
  try {
    window.localStorage.removeItem('token');
    window.localStorage.removeItem('user');
  } catch {
    // A restricted storage API should not crash the logout interaction.
  } finally {
    window.dispatchEvent(new Event(AUTH_CHANGED));
  }
}

export function subscribeAuthChanges(callback: () => void) {
  let expiryTimer: number | undefined;
  function scheduleExpiry() {
    window.clearTimeout(expiryTimer);
    try {
      const remaining = tokenExpiresAt(window.localStorage.getItem('token')) - Date.now();
      if (remaining > 0) {
        expiryTimer = window.setTimeout(notify, Math.min(remaining + 50, 2_147_483_647));
      }
    } catch { /* Storage can be unavailable in a restricted browser. */ }
  }
  function notify() {
    callback();
    scheduleExpiry();
  }
  function onStorage(event: StorageEvent) {
    if (event.key === null || event.key === 'token' || event.key === 'user') notify();
  }
  window.addEventListener(AUTH_CHANGED, notify);
  window.addEventListener('storage', onStorage);
  window.addEventListener('focus', notify);
  scheduleExpiry();
  return () => {
    window.clearTimeout(expiryTimer);
    window.removeEventListener(AUTH_CHANGED, notify);
    window.removeEventListener('storage', onStorage);
    window.removeEventListener('focus', notify);
  };
}
