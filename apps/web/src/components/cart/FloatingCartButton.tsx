'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCart } from '@/context/useCart';

interface FloatingCartButtonProps {
  showAddedNotification: boolean;
}

export default function FloatingCartButton({
  showAddedNotification,
}: FloatingCartButtonProps) {
  const { itemCount, hydrated } = useCart();
  const pathname = usePathname();

  const staffRoute = pathname === '/staff' || pathname?.startsWith('/staff/');
  if (!hydrated || itemCount < 1 || pathname === '/cart' || staffRoute) {
    return null;
  }

  return (
    <>
      {/* Allow the last page actions to scroll clear of the floating button. */}
      <div aria-hidden="true" className="h-[calc(6rem+env(safe-area-inset-bottom))] shrink-0" />
      <div
        className="pointer-events-none fixed z-30 flex max-w-[calc(100vw-2rem)] flex-col items-end gap-3"
        style={{
          bottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))',
          right: 'calc(1rem + env(safe-area-inset-right, 0px))',
        }}
      >
        <div aria-atomic="true" aria-live="polite" role="status">
          {showAddedNotification && (
            <p className="rounded-2xl border border-coffee-200 bg-cream-50 px-4 py-3 text-sm font-semibold text-coffee-900 shadow-lg">
              <span aria-hidden="true" className="mr-2">✓</span>
              Đã thêm vào giỏ hàng
            </p>
          )}
        </div>
        <Link
          aria-label={`Xem giỏ hàng, ${itemCount} sản phẩm`}
          className="pointer-events-auto inline-flex min-h-14 items-center gap-3 rounded-full border border-coffee-600 bg-coffee-800 px-5 py-3 font-bold text-cream-50 shadow-xl transition-colors hover:bg-coffee-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coffee-600 focus-visible:ring-offset-4 focus-visible:ring-offset-cream-100 sm:px-6"
          href="/cart"
        >
          <svg aria-hidden="true" className="h-6 w-6 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 3h2l2.2 11.2a2 2 0 002 1.6h8.7a2 2 0 002-1.6L21 7H6M10 21h.01M18 21h.01" />
          </svg>
          <span className="text-sm">Giỏ hàng</span>
          <span className="inline-flex min-h-7 min-w-7 items-center justify-center rounded-full bg-cream-100 px-2 text-sm tabular-nums text-coffee-900">
            {itemCount}
          </span>
        </Link>
      </div>
    </>
  );
}
