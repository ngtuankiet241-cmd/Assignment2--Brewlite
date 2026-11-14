import { BadRequestException, InternalServerErrorException } from '@nestjs/common';
import type { DrinkSizeOption, Product, ToppingOption } from '@prisma/client';
import { priceOrderItems } from './order-pricing';

const products: Pick<Product, 'id' | 'name' | 'price'>[] = [
  { id: 'p1', name: 'Coffee', price: 35000 },
];
const sizes = [
  { id: 'S', priceAdjustment: -5000 },
  { id: 'M', priceAdjustment: 0 },
  { id: 'L', priceAdjustment: 6500 },
] satisfies Pick<DrinkSizeOption, 'id' | 'priceAdjustment'>[];
const toppings = [
  { name: 'Trân châu đen', unitPrice: 7500 },
  { name: 'Thạch đào', unitPrice: 8000 },
] satisfies Pick<ToppingOption, 'name' | 'unitPrice'>[];

describe('priceOrderItems', () => {
  it('uses the database-configured size and topping prices', () => {
    const result = priceOrderItems(
      [{ productId: 'p1', quantity: 2, size: 'L', toppings: 'Trân châu đen x2' }],
      products,
      sizes,
      toppings,
    );

    expect(result.subtotalAmount).toBe(113000);
    expect(result.items[0]).toMatchObject({
      unitPrice: 56500,
      size: 'L',
      toppings: 'Trân châu đen x2',
      itemTotal: 113000,
    });
  });

  it('rejects sizes or toppings that are not active database options', () => {
    expect(() => priceOrderItems(
      [{ productId: 'p1', quantity: 1, size: 'XL' }],
      products,
      sizes,
      toppings,
    )).toThrow(BadRequestException);

    expect(() => priceOrderItems(
      [{ productId: 'p1', quantity: 1, toppings: 'Unknown topping' }],
      products,
      sizes,
      toppings,
    )).toThrow(BadRequestException);
  });

  it('rejects invalid database topping prices rather than charging a negative amount', () => {
    expect(() => priceOrderItems(
      [{ productId: 'p1', quantity: 1, toppings: 'Trân châu đen' }],
      products,
      sizes,
      [{ name: 'Trân châu đen', unitPrice: -1 }],
    )).toThrow(InternalServerErrorException);
  });
});
