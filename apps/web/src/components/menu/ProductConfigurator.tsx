'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import type { DrinkSize, ProductConfiguration, Topping } from '@/types/cart';
import type { Product } from '@/types/product';
import { useCart } from '@/context/useCart';
import { formatCurrencyVND } from '@/lib/formatCurrency';
import { parseProductConfiguration } from '@/lib/productConfiguration';

interface ProductConfiguratorProps {
  product: Product;
  onClose: () => void;
}

export default function ProductConfigurator({
  product,
  onClose,
}: ProductConfiguratorProps) {
  const { addItem, hydrated } = useCart();
  const [size, setSize] = useState<DrinkSize>('M');
  const [quantity, setQuantity] = useState(1);
  const [configuration, setConfiguration] = useState<ProductConfiguration | null>(null);
  const [configurationError, setConfigurationError] = useState<string | null>(null);
  const [retryIndex, setRetryIndex] = useState(0);
  const [toppings, setToppings] = useState<Topping[]>([]);
  const selectedSize = configuration?.sizes.find((option) => option.id === size)
    ?? configuration?.sizes[0];
  const toppingPrice = toppings.reduce(
    (total, topping) => total + topping.unitPrice * topping.quantity,
    0,
  );
  const unitPrice = Math.max(
    0,
    product.price + (selectedSize?.priceAdjustment ?? 0) + toppingPrice,
  );
  const totalPrice = unitPrice * quantity;
  const maximumQuantity =
    typeof product.stock === 'number' && product.stock > 0
      ? product.stock
      : Number.MAX_SAFE_INTEGER;

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    async function loadConfiguration() {
      setConfiguration(null);
      setConfigurationError(null);
      try {
        const response = await fetch('/api/products/configuration', {
          cache: 'no-store',
          signal: controller.signal,
          headers: { Accept: 'application/json' },
        });
        if (!response.ok) {
          throw new Error(`Không thể tải tùy chọn sản phẩm (HTTP ${response.status}).`);
        }

        const nextConfiguration = parseProductConfiguration(await response.json());
        if (!nextConfiguration.sizes.length) {
          throw new Error('Chưa có kích cỡ nào được cấu hình. Vui lòng thử lại sau.');
        }

        if (active) {
          setConfiguration(nextConfiguration);
          setSize((current) => nextConfiguration.sizes.some((option) => option.id === current)
            ? current
            : nextConfiguration.sizes[0].id);
          setToppings(nextConfiguration.toppings.map((topping) => ({ ...topping, quantity: 0 })));
        }
      } catch (cause) {
        if (active && !controller.signal.aborted) {
          setConfigurationError(cause instanceof Error
            ? cause.message
            : 'Không thể tải tùy chọn sản phẩm. Vui lòng thử lại.');
        }
      }
    }

    loadConfiguration();
    return () => {
      active = false;
      controller.abort();
    };
  }, [retryIndex]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const selectedToppings = useMemo(
    () => toppings.filter((topping) => topping.quantity > 0),
    [toppings],
  );

  function changeToppingQuantity(toppingId: string, change: number) {
    setToppings((current) =>
      current.map((topping) =>
        topping.id === toppingId
          ? {
              ...topping,
              quantity: Math.max(0, Math.min(5, topping.quantity + change)),
            }
          : topping,
      ),
    );
  }

  function handleAddToCart() {
    if (!selectedSize) return;
    addItem({
      product,
      size: selectedSize.id,
      sizePriceAdjustment: selectedSize.priceAdjustment,
      toppings: selectedToppings,
      quantity,
    });
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 backdrop-blur-xs sm:items-center sm:p-4"
      role="presentation"
      onClick={onClose}
    >
      <section
        aria-labelledby="modal-product-title"
        aria-modal="true"
        className="relative max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-coffee-100 bg-white p-4 shadow-2xl sm:rounded-3xl sm:p-6"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
      >
        <button
          aria-label="Đóng cửa sổ tùy chỉnh"
          className="absolute right-3 top-3 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-lg text-coffee-800 shadow-sm"
          onClick={onClose}
          type="button"
        >
          ×
        </button>

        <div className="flex items-center gap-3 pr-9">
          <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-2xl bg-cream-50 sm:h-24 sm:w-24">
            <Image
              alt={product.name}
              className="object-contain p-2"
              fill
              sizes="96px"
              src={product.imageUrl}
            />
          </div>
          <div className="min-w-0">
            <span className="text-[10px] font-bold uppercase tracking-wider text-coffee-500">
              {product.categoryName}
            </span>
            <h2
              className="break-words text-lg font-bold text-coffee-950 sm:text-xl"
              id="modal-product-title"
            >
              {product.name}
            </h2>
            <p className="text-xs leading-relaxed text-coffee-700/80">
              {product.description}
            </p>
          </div>
        </div>

        <fieldset className="mt-5">
          <legend className="mb-2 text-sm font-bold text-coffee-950">
            Chọn kích cỡ
          </legend>
          {configurationError ? (
            <div className="rounded-xl bg-red-50 p-3 text-sm text-red-800" role="alert">
              <p>{configurationError}</p>
              <button
                className="mt-2 font-semibold underline"
                onClick={() => setRetryIndex((current) => current + 1)}
                type="button"
              >
                Thử tải lại
              </button>
            </div>
          ) : !configuration ? (
            <p aria-live="polite" className="text-sm text-coffee-600">
              Đang tải tùy chọn...
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {configuration.sizes.map((option) => (
                <button
                  aria-pressed={size === option.id}
                  className={`min-h-12 rounded-xl border px-2 py-2 text-left transition ${
                    size === option.id
                      ? 'border-coffee-800 bg-coffee-50 text-coffee-950 ring-1 ring-coffee-800'
                      : 'border-coffee-200 bg-white text-coffee-800'
                  }`}
                  key={option.id}
                  onClick={() => setSize(option.id)}
                  type="button"
                >
                  <span className="block text-xs font-bold">{option.label}</span>
                  <span className="mt-0.5 block text-[10px] text-coffee-600">
                    {option.priceAdjustment === 0
                      ? 'Giá gốc'
                      : `${option.priceAdjustment > 0 ? '+' : ''}${formatCurrencyVND(option.priceAdjustment)}`}
                  </span>
                </button>
              ))}
            </div>
          )}
        </fieldset>

        <fieldset className="mt-5">
          <legend className="mb-1 text-sm font-bold text-coffee-950">
            Topping <span className="font-normal text-coffee-500">(tùy chọn)</span>
          </legend>
          <div className="divide-y divide-coffee-100">
            {toppings.map((topping) => (
              <div
                className="flex min-h-14 items-center justify-between gap-3 py-2"
                key={topping.id}
              >
                <div>
                  <p className="text-xs font-semibold text-coffee-900">
                    {topping.name}
                  </p>
                  <p className="text-[10px] text-coffee-500">
                    +{formatCurrencyVND(topping.unitPrice)} / phần
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    aria-label={`Giảm ${topping.name}`}
                    className="h-10 w-10 rounded-full border border-coffee-200 text-base text-coffee-800 disabled:opacity-40"
                    disabled={topping.quantity === 0}
                    onClick={() => changeToppingQuantity(topping.id, -1)}
                    type="button"
                  >
                    −
                  </button>
                  <span
                    aria-label={`Số lượng ${topping.name}`}
                    className="w-4 text-center text-xs font-semibold"
                  >
                    {topping.quantity}
                  </span>
                  <button
                    aria-label={`Tăng ${topping.name}`}
                    className="h-10 w-10 rounded-full border border-coffee-200 text-base text-coffee-800 disabled:opacity-40"
                    disabled={topping.quantity === 5}
                    onClick={() => changeToppingQuantity(topping.id, 1)}
                    type="button"
                  >
                    +
                  </button>
                </div>
              </div>
            ))}
          </div>
        </fieldset>

        <div className="mt-4 flex items-center justify-between rounded-2xl bg-cream-50 p-3">
          <div>
            <p className="text-[10px] text-coffee-600">Số lượng ly</p>
            <div className="mt-1 flex items-center gap-2">
              <button
                aria-label="Giảm số ly"
                className="h-10 w-10 rounded-full border border-coffee-200 bg-white text-base disabled:opacity-40"
                disabled={quantity === 1}
                onClick={() => setQuantity((current) => Math.max(1, current - 1))}
                type="button"
              >
                −
              </button>
              <span className="w-5 text-center text-sm font-bold">{quantity}</span>
              <button
                aria-label="Tăng số ly"
                className="h-10 w-10 rounded-full border border-coffee-200 bg-white text-base disabled:opacity-40"
                disabled={quantity >= maximumQuantity}
                onClick={() =>
                  setQuantity((current) => Math.min(maximumQuantity, current + 1))
                }
                type="button"
              >
                +
              </button>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-coffee-600">
              {formatCurrencyVND(unitPrice)} / ly
            </p>
            <p className="text-lg font-extrabold text-coffee-900">
              {formatCurrencyVND(totalPrice)}
            </p>
          </div>
        </div>

        <button
          className="mt-3 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-coffee-800 px-5 text-sm font-bold text-cream-50 shadow-sm transition hover:bg-coffee-700 active:scale-[0.99] disabled:cursor-wait disabled:opacity-60"
          onClick={handleAddToCart}
          disabled={!hydrated || !configuration || !selectedSize || Boolean(configurationError)}
          type="button"
        >
          {hydrated ? (
            <>
              Thêm vào giỏ
              <span aria-hidden="true">·</span>
              {formatCurrencyVND(totalPrice)}
            </>
          ) : (
            'Đang tải giỏ hàng...'
          )}
        </button>
      </section>
    </div>
  );
}
