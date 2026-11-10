import { createContext } from 'react';
import type { AddCartItemInput, CartItem } from '@/types/cart';

export interface CartContextValue {
  items: CartItem[];
  itemCount: number;
  subtotal: number;
  hydrated: boolean;
  storageError: string | null;
  addItem: (input: AddCartItemInput) => void;
  updateQuantity: (itemId: string, quantity: number) => void;
  removeItem: (itemId: string) => void;
  clearCart: () => void;
}

export const CartContext = createContext<CartContextValue | null>(null);
