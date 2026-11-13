import type { Product } from '@/types/product';

export type DrinkSize = 'S' | 'M' | 'L';

export interface Topping {
  id: string;
  name: string;
  unitPrice: number;
  quantity: number;
}

export interface CartItem {
  id: string;
  productId: string;
  productName: string;
  description: string;
  imageUrl: string;
  categoryName: string;
  basePrice: number;
  size: DrinkSize;
  sizePriceAdjustment: number;
  toppings: Topping[];
  quantity: number;
  stock?: number;
}

export interface AddCartItemInput {
  product: Product;
  size: DrinkSize;
  toppings: Topping[];
  quantity: number;
}

export const DRINK_SIZES: {
  id: DrinkSize;
  label: string;
  priceAdjustment: number;
}[] = [
  { id: 'S', label: 'Nhỏ', priceAdjustment: -5000 },
  { id: 'M', label: 'Vừa', priceAdjustment: 0 },
  { id: 'L', label: 'Lớn', priceAdjustment: 5000 },
];

export const AVAILABLE_TOPPINGS: Omit<Topping, 'quantity'>[] = [
  { id: 'pearls', name: 'Trân châu đen', unitPrice: 7000 },
  { id: 'peach-jelly', name: 'Thạch đào', unitPrice: 8000 },
  { id: 'cheese-foam', name: 'Kem cheese', unitPrice: 10000 },
];

export function getCartItemToppingPrice(item: Pick<CartItem, 'toppings'>): number {
  return item.toppings.reduce(
    (total, topping) => total + topping.unitPrice * topping.quantity,
    0,
  );
}

export function getCartItemUnitPrice(item: CartItem): number {
  return Math.max(0, item.basePrice + item.sizePriceAdjustment + getCartItemToppingPrice(item));
}
