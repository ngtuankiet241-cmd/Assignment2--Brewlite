import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Order, Prisma } from '@prisma/client';
import { aggregateQuantities, assertReservationActive, OptimisticStockConflict, reservationExpired, reserveStock } from './stock-reservation';

describe('Stock reservation rules', () => {
  const mockTx = { product: { findMany: jest.fn(), updateMany: jest.fn() } };
  const tx = mockTx as unknown as Prisma.TransactionClient;

  beforeEach(() => {
    jest.resetAllMocks();
    mockTx.product.findMany.mockResolvedValue([{ id: 'p1', name: 'Coffee', stock: 5, version: 7 }]);
    mockTx.product.updateMany.mockResolvedValue({ count: 1 });
  });

  it('UT-INV-01: aggregates the same product across sizes/toppings and sorts product locks', () => {
    expect([...aggregateQuantities([
      { productId: 'p2', quantity: 1 }, { productId: 'p1', quantity: 2 }, { productId: 'p2', quantity: 3 },
    ])]).toEqual([['p1', 2], ['p2', 4]]);
  });

  it.each([0, -1, 1.5, NaN, Infinity, '2', undefined, 2147483648])
    ('UT-INV-02: rejects invalid quantity %s', (quantity) => {
      expect(() => aggregateQuantities([{ productId: 'p1', quantity: quantity as number }]))
        .toThrow(BadRequestException);
    });

  it('UT-INV-03: rejects an overflowing sum of otherwise valid quantities', () => {
    expect(() => aggregateQuantities([
      { productId: 'p1', quantity: 2147483647 }, { productId: 'p1', quantity: 1 },
    ])).toThrow(BadRequestException);
  });

  it('UT-INV-04: decrements only if both the version and available stock still match', async () => {
    await reserveStock(tx, new Map([['p1', 3]]));
    expect(mockTx.product.updateMany).toHaveBeenCalledWith({
      where: { id: 'p1', version: 7, stock: { gte: 3 } },
      data: { stock: { decrement: 3 }, version: { increment: 1 } },
    });
  });

  it('UT-INV-05: stale optimistic update aborts the transaction for retry', async () => {
    mockTx.product.updateMany.mockResolvedValue({ count: 0 });
    await expect(reserveStock(tx, new Map([['p1', 3]]))).rejects.toThrow(OptimisticStockConflict);
  });

  it('UT-INV-06: insufficient stock rejects before decrementing', async () => {
    await expect(reserveStock(tx, new Map([['p1', 6]]))).rejects.toThrow(ConflictException);
    expect(mockTx.product.updateMany).not.toHaveBeenCalled();
  });

  it('UT-INV-07: unknown products reject before decrementing', async () => {
    await expect(reserveStock(tx, new Map([['missing', 1]]))).rejects.toThrow(NotFoundException);
    expect(mockTx.product.updateMany).not.toHaveBeenCalled();
  });

  it('UT-INV-08: rejects payment at the exact TTL boundary', () => {
    const order = { reservationStatus: 'HELD', reservationExpiresAt: new Date(0) } as Order;
    expect(reservationExpired(order, new Date(-1))).toBe(false);
    expect(reservationExpired(order, new Date(0))).toBe(true);
    expect(() => assertReservationActive(order)).toThrow(ConflictException);
    expect(() => assertReservationActive({ ...order, reservationStatus: 'CONSUMED' })).not.toThrow();
    expect(() => assertReservationActive({ ...order, reservationStatus: 'RELEASED' })).toThrow(ConflictException);
  });
});
