import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// Helper logic directly matching src/types/cart.ts
export function getCartItemUnitPrice(item) {
  const toppingTotal = (item.toppings || []).reduce(
    (total, topping) => total + topping.unitPrice * topping.quantity,
    0,
  );
  return Math.max(0, item.basePrice + (item.sizePriceAdjustment || 0) + toppingTotal);
}

export function calculateCartTotal(items) {
  return items.reduce((sum, item) => sum + getCartItemUnitPrice(item) * item.quantity, 0);
}

describe('Cart Business Logic Specifications (Sprint 2 MVP)', () => {
  const mockProduct = {
    id: 'prod-1',
    name: 'Cà phê Muối',
    basePrice: 35000,
    size: 'M',
    sizePriceAdjustment: 0,
    toppings: [],
    quantity: 2,
  };

  it('UT-CART-01: calculates base drink price without toppings correctly', () => {
    const unitPrice = getCartItemUnitPrice(mockProduct);
    assert.equal(unitPrice, 35000);
    assert.equal(calculateCartTotal([mockProduct]), 70000);
  });

  it('UT-CART-02: calculates size adjustments correctly (Size L +5000, Size S -5000)', () => {
    const itemSizeL = { ...mockProduct, size: 'L', sizePriceAdjustment: 5000 };
    const itemSizeS = { ...mockProduct, size: 'S', sizePriceAdjustment: -5000 };

    assert.equal(getCartItemUnitPrice(itemSizeL), 40000);
    assert.equal(getCartItemUnitPrice(itemSizeS), 30000);
  });

  it('UT-CART-03: calculates multiple toppings surcharge accurately', () => {
    const itemWithToppings = {
      ...mockProduct,
      size: 'L',
      sizePriceAdjustment: 5000,
      toppings: [
        { id: 'pearls', name: 'Trân châu đen', unitPrice: 7000, quantity: 1 },
        { id: 'cheese-foam', name: 'Kem cheese', unitPrice: 10000, quantity: 2 },
      ],
      quantity: 1,
    };

    // 35000 (base) + 5000 (size L) + 7000 (1 pearl) + 20000 (2 cheese foams) = 67000
    assert.equal(getCartItemUnitPrice(itemWithToppings), 67000);
  });

  it('UT-CART-04: ensures total is never negative even with extreme discounts', () => {
    const discountedItem = {
      basePrice: 10000,
      sizePriceAdjustment: -20000,
      toppings: [],
      quantity: 1,
    };
    assert.equal(getCartItemUnitPrice(discountedItem), 0);
  });
});

