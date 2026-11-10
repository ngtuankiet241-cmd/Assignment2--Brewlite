'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { AddCartItemInput, CartItem, Topping } from '@/types/cart';
import { getCartItemUnitPrice } from '@/types/cart';
import { CartContext, type CartContextValue } from './CartStore';

const CART_STORAGE_KEY = 'brewlite-cart-v1';

function isTopping(value: unknown): value is Topping {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const topping = value as Record<string, unknown>;
  return (
    typeof topping.id === 'string' &&
    typeof topping.name === 'string' &&
    typeof topping.unitPrice === 'number' &&
    Number.isFinite(topping.unitPrice) &&
    topping.unitPrice >= 0 &&
    Number.isInteger(topping.quantity) &&
    (topping.quantity as number) >= 0
  );
}

function isCartItem(value: unknown): value is CartItem {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const item = value as Record<string, unknown>;
  return (
    typeof item.id === 'string' &&
    typeof item.productId === 'string' &&
    typeof item.productName === 'string' &&
    typeof item.description === 'string' &&
    typeof item.imageUrl === 'string' &&
    typeof item.categoryName === 'string' &&
    typeof item.basePrice === 'number' &&
    Number.isFinite(item.basePrice) &&
    item.basePrice >= 0 &&
    (item.size === 'S' || item.size === 'M' || item.size === 'L') &&
    typeof item.sizePriceAdjustment === 'number' &&
    Number.isFinite(item.sizePriceAdjustment) &&
    Array.isArray(item.toppings) &&
    item.toppings.every(isTopping) &&
    Number.isInteger(item.quantity) &&
    (item.quantity as number) >= 1 &&
    (item.stock === undefined ||
      (typeof item.stock === 'number' &&
        Number.isFinite(item.stock) &&
        item.stock >= 0))
  );
}

function readStoredItems(rawValue: string): CartItem[] {
  const parsed: unknown = JSON.parse(rawValue);
  if (!Array.isArray(parsed) || !parsed.every(isCartItem)) {
    throw new Error('Dữ liệu giỏ hàng đã lưu không hợp lệ.');
  }

  return parsed;
}

function sameConfiguration(a: CartItem, b: AddCartItemInput): boolean {
  if (
    a.productId !== b.product.id ||
    a.basePrice !== b.product.price ||
    a.size !== b.size
  ) {
    return false;
  }

  const aToppings = a.toppings
    .filter((topping) => topping.quantity > 0)
    .map(({ id, quantity, unitPrice }) => `${id}:${quantity}:${unitPrice}`)
    .sort();
  const bToppings = b.toppings
    .filter((topping) => topping.quantity > 0)
    .map(({ id, quantity, unitPrice }) => `${id}:${quantity}:${unitPrice}`)
    .sort();

  return (
    aToppings.length === bToppings.length &&
    aToppings.every((topping, index) => topping === bToppings[index])
  );
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [storageError, setStorageError] = useState<string | null>(null);
  const itemsRef = useRef(items);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const saved = window.localStorage.getItem(CART_STORAGE_KEY);
        if (saved) {
          const storedItems = readStoredItems(saved);
          itemsRef.current = storedItems;
          setItems(storedItems);
        }
      } catch (error) {
        setStorageError(
          error instanceof Error
            ? error.message
            : 'Không thể đọc giỏ hàng đã lưu trên thiết bị này.',
        );
      } finally {
        setHydrated(true);
      }
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  const commitItems = useCallback((nextItems: CartItem[]) => {
    itemsRef.current = nextItems;
    setItems(nextItems);
    try {
      window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(nextItems));
      setStorageError(null);
    } catch {
      setStorageError('Không thể lưu giỏ hàng trên thiết bị này.');
    }
  }, []);

  const addItem = useCallback((input: AddCartItemInput) => {
    const sizePriceAdjustment =
      input.size === 'S' ? -5000 : input.size === 'L' ? 5000 : 0;
    const newItem: CartItem = {
      id: crypto.randomUUID(),
      productId: input.product.id,
      productName: input.product.name,
      description: input.product.description,
      imageUrl: input.product.imageUrl,
      categoryName: input.product.categoryName,
      basePrice: input.product.price,
      size: input.size,
      sizePriceAdjustment,
      toppings: input.toppings.filter((topping) => topping.quantity > 0),
      quantity: input.quantity,
      stock: input.product.stock,
    };

    const currentItems = itemsRef.current;
    const matchingIndex = currentItems.findIndex((item) =>
      sameConfiguration(item, input),
    );
    if (matchingIndex < 0) {
      commitItems([...currentItems, newItem]);
      return;
    }

    const nextItems = [...currentItems];
    const matchingItem = nextItems[matchingIndex];
    const maximumQuantity = matchingItem.stock ?? Number.MAX_SAFE_INTEGER;
    nextItems[matchingIndex] = {
      ...matchingItem,
      quantity: Math.min(
        maximumQuantity,
        matchingItem.quantity + input.quantity,
      ),
    };
    commitItems(nextItems);
  }, [commitItems]);

  const updateQuantity = useCallback((itemId: string, quantity: number) => {
    commitItems(
      itemsRef.current.map((item) =>
        item.id === itemId
          ? {
              ...item,
              quantity: Math.max(
                1,
                Math.min(item.stock ?? Number.MAX_SAFE_INTEGER, quantity),
              ),
            }
          : item,
      ),
    );
  }, [commitItems]);

  const removeItem = useCallback((itemId: string) => {
    commitItems(itemsRef.current.filter((item) => item.id !== itemId));
  }, [commitItems]);

  const clearCart = useCallback(() => {
    commitItems([]);
  }, [commitItems]);

  const value = useMemo<CartContextValue>(() => {
    const itemCount = items.reduce((total, item) => total + item.quantity, 0);
    const subtotal = items.reduce(
      (total, item) => total + getCartItemUnitPrice(item) * item.quantity,
      0,
    );

    return {
      items,
      itemCount,
      subtotal,
      hydrated,
      storageError,
      addItem,
      updateQuantity,
      removeItem,
      clearCart,
    };
  }, [
    addItem,
    clearCart,
    hydrated,
    items,
    removeItem,
    storageError,
    updateQuantity,
  ]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}
