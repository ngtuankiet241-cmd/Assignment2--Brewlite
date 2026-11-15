export interface CheckoutAttempt {
  request: string;
  key: string;
}

type CheckoutStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
const storageKey = 'brewlite:checkout-attempt';

function browserStorage(): CheckoutStorage | undefined {
  try { return typeof window === 'undefined' ? undefined : window.sessionStorage; }
  catch { return undefined; }
}

export function getCheckoutAttempt(
  request: string,
  previous: CheckoutAttempt | null,
  storage = browserStorage(),
): CheckoutAttempt {
  if (previous?.request === request) return previous;
  try {
    const saved: unknown = JSON.parse(storage?.getItem(storageKey) ?? 'null');
    if (saved && typeof saved === 'object' && 'request' in saved && saved.request === request &&
        'key' in saved && typeof saved.key === 'string' && saved.key.length > 0) {
      return { request, key: saved.key };
    }
  } catch { /* A blocked or unavailable storage falls back to the in-memory ref. */ }
  const attempt = { request, key: crypto.randomUUID() };
  try { storage?.setItem(storageKey, JSON.stringify(attempt)); } catch { /* Keep the in-memory key. */ }
  return attempt;
}

export function clearCheckoutAttempt(storage = browserStorage()) {
  try { storage?.removeItem(storageKey); } catch { /* Checkout already succeeded. */ }
}
