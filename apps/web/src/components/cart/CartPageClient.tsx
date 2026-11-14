'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useCart } from '@/context/useCart';
import { getCartItemUnitPrice } from '@/types/cart';
import { formatCurrencyVND } from '@/lib/formatCurrency';

export default function CartPageClient() {
  const {
    items,
    itemCount,
    subtotal,
    hydrated,
    storageError,
    updateQuantity,
    removeItem,
  } = useCart();

  if (!hydrated) {
    return (
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10 sm:px-6">
        <p aria-live="polite" className="py-16 text-center text-sm text-coffee-600" role="status">
          Đang tải giỏ hàng...
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
      <div className="mb-6">
        <Link className="text-xs font-semibold text-coffee-600 hover:text-coffee-900" href="/menu">
          ← Tiếp tục chọn món
        </Link>
        <h1 className="mt-3 text-2xl font-black tracking-tight text-coffee-950 sm:text-3xl">
          Giỏ hàng
        </h1>
        <p className="mt-1 text-sm text-coffee-600">
          {itemCount > 0
            ? `${itemCount} ly nước đã chọn`
            : 'Các món bạn chọn sẽ xuất hiện ở đây.'}
        </p>
      </div>

      {storageError && (
        <p className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900" role="alert">
          {storageError} Các thao tác trong phiên này vẫn dùng được, nhưng thay đổi có thể không được lưu sau khi đóng trang.
        </p>
      )}

      {items.length === 0 ? (
        <section className="flex min-h-72 flex-col items-center justify-center rounded-3xl border border-dashed border-coffee-300 bg-white/70 px-5 text-center">
          <span aria-hidden="true" className="text-4xl">🛒</span>
          <h2 className="mt-4 text-lg font-bold text-coffee-950">Giỏ hàng đang trống</h2>
          <p className="mt-1 max-w-sm text-sm text-coffee-600">
            Ghé thực đơn, chọn size và topping bạn thích nhé.
          </p>
          <Link
            className="mt-5 inline-flex min-h-11 items-center justify-center rounded-full bg-coffee-800 px-5 text-sm font-bold text-white transition hover:bg-coffee-700"
            href="/menu"
          >
            Xem thực đơn
          </Link>
        </section>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
          <section aria-label="Các món trong giỏ" className="space-y-3">
            {items.map((item) => {
              const unitPrice = getCartItemUnitPrice(item);
              const toppingDescription = item.toppings
                .map((topping) =>
                  topping.quantity > 1
                    ? `${topping.name} × ${topping.quantity}`
                    : topping.name,
                )
                .join(', ');

              return (
                <article
                  aria-label={`${item.productName}, size ${item.size}`}
                  className="flex gap-3 rounded-2xl border border-coffee-200/80 bg-white p-3 shadow-2xs sm:gap-4 sm:p-4"
                  key={item.id}
                >
                  <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-cream-50 sm:h-28 sm:w-28">
                    <Image
                      alt={item.productName}
                      className="object-contain p-2"
                      fill
                      sizes="112px"
                      src={item.imageUrl}
                    />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[10px] font-bold uppercase tracking-wide text-coffee-500">
                          {item.categoryName} · Size {item.size}
                        </p>
                        <h2 className="mt-0.5 truncate text-sm font-bold text-coffee-950 sm:text-base">
                          {item.productName}
                        </h2>
                      </div>
                      <button
                        aria-label={`Xóa ${item.productName} size ${item.size} khỏi giỏ`}
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-coffee-500 transition hover:bg-red-50 hover:text-red-700"
                        onClick={() => removeItem(item.id)}
                        type="button"
                      >
                        <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 7h16M10 11v6m4-6v6M5 7l1 14h12l1-14M9 7V4h6v3" />
                        </svg>
                      </button>
                    </div>

                    <p className="mt-1 line-clamp-1 min-h-4 text-[11px] text-coffee-600">
                      {toppingDescription || 'Không thêm topping'}
                    </p>

                    <div className="mt-2 flex flex-wrap items-end justify-between gap-2">
                      <div>
                        <p className="text-[10px] text-coffee-500">
                          {formatCurrencyVND(unitPrice)} / ly
                        </p>
                        <p className="text-sm font-extrabold text-coffee-900">
                          {formatCurrencyVND(unitPrice * item.quantity)}
                        </p>
                      </div>
                      <div aria-label={`Số lượng ${item.productName}`} className="flex items-center gap-2">
                        <button
                          aria-label={`Giảm số lượng ${item.productName}`}
                          className="h-10 w-10 rounded-full border border-coffee-200 text-base text-coffee-800 disabled:opacity-40"
                          disabled={item.quantity <= 1}
                          onClick={() => updateQuantity(item.id, item.quantity - 1)}
                          type="button"
                        >
                          −
                        </button>
                        <span className="w-5 text-center text-sm font-bold">{item.quantity}</span>
                        <button
                          aria-label={`Tăng số lượng ${item.productName}`}
                          className="h-10 w-10 rounded-full border border-coffee-200 text-base text-coffee-800 disabled:opacity-40"
                          disabled={typeof item.stock === 'number' && item.quantity >= item.stock}
                          onClick={() => updateQuantity(item.id, item.quantity + 1)}
                          type="button"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </section>

          <aside className="h-fit rounded-2xl border border-coffee-200/80 bg-white p-4 shadow-2xs sm:p-5">
            <h2 className="text-base font-bold text-coffee-950">Tạm tính đơn hàng</h2>
            <div className="mt-4 flex justify-between text-sm text-coffee-700">
              <span>Tạm tính ({itemCount} ly)</span>
              <span>{formatCurrencyVND(subtotal)}</span>
            </div>
            <div className="my-4 border-t border-coffee-100" />
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-bold text-coffee-950">Tổng cộng</span>
              <span className="text-lg font-black text-coffee-900">
                {formatCurrencyVND(subtotal)}
              </span>
            </div>
            <Link
              className="mt-5 inline-flex min-h-12 w-full items-center justify-center rounded-full bg-coffee-800 px-4 text-sm font-bold text-white shadow-sm transition hover:bg-coffee-700 active:scale-[0.98]"
              href="/checkout"
            >
              Tiến hành đặt hàng →
            </Link>
            <p className="mt-3 text-center text-[10px] leading-relaxed text-coffee-500">
              Giỏ hàng được lưu trên thiết bị này. Phí và thanh toán sẽ được xác nhận ở bước đặt hàng.
            </p>
          </aside>
        </div>
      )}
    </main>
  );
}
