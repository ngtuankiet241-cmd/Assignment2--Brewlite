import type { Product } from '@/types/product';

export type DrinkSize = string;

export interface DrinkSizeOption {
  id: DrinkSize;
  label: string;
  priceAdjustment: number;
}

export interface Topping {
  id: string;
  name: string;
  unitPrice: number;
  quantity: number;
}

export interface ProductConfiguration {
  sizes: DrinkSizeOption[];
  toppings: Omit<Topping, 'quantity'>[];
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
  sizePriceAdjustment: number;
  toppings: Topping[];
  quantity: number;
}

export function getCartItemUnitPrice(item: CartItem): number {
  const toppingTotal = item.toppings.reduce(
    (total, topping) => total + topping.unitPrice * topping.quantity,
    0,
  );

  return Math.max(0, item.basePrice + item.sizePriceAdjustment + toppingTotal);
}
