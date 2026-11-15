import { ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { InventoryService } from './inventory.service';
import { OptimisticStockConflict } from './stock-reservation';

describe('InventoryService', () => {
  let service: InventoryService;
  const mockPrisma = {
    $transaction: jest.fn(),
    $queryRaw: jest.fn(),
    order: { findMany: jest.fn(), update: jest.fn() },
    orderItem: { findMany: jest.fn() },
    product: { update: jest.fn() },
  };
  const held = {
    id: 'o1', status: 'PENDING', reservationStatus: 'HELD', reservationExpiresAt: new Date(0),
  };

  beforeEach(() => {
    jest.resetAllMocks();
    service = new InventoryService(mockPrisma as unknown as PrismaService);
    mockPrisma.$transaction.mockImplementation((work) => work(mockPrisma));
    mockPrisma.order.findMany.mockResolvedValue([{ id: 'o1' }]);
    mockPrisma.$queryRaw.mockResolvedValue([held]);
    mockPrisma.orderItem.findMany.mockResolvedValue([
      { productId: 'p1', quantity: 2 }, { productId: 'p1', quantity: 1 },
    ]);
  });

  it('UT-INV-09: retries the entire transaction after an optimistic conflict', async () => {
    const work = jest.fn().mockRejectedValueOnce(new OptimisticStockConflict()).mockResolvedValueOnce('order');
    await expect(service.withStockRetry(work)).resolves.toBe('order');
    expect(work).toHaveBeenCalledTimes(2);
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(2);
  });

  it('UT-INV-10: retries database write conflicts/deadlocks', async () => {
    const error = new Prisma.PrismaClientKnownRequestError('write conflict', { code: 'P2034', clientVersion: '5.22.0' });
    const work = jest.fn().mockRejectedValueOnce(error).mockResolvedValueOnce('order');
    await expect(service.withStockRetry(work)).resolves.toBe('order');
    expect(work).toHaveBeenCalledTimes(2);
  });

  it('UT-INV-11: bounds retries and returns 409 under persistent contention', async () => {
    const work = jest.fn().mockRejectedValue(new OptimisticStockConflict());
    await expect(service.withStockRetry(work)).rejects.toThrow(ConflictException);
    expect(work).toHaveBeenCalledTimes(5);
  });

  it('UT-INV-12: does not retry insufficient stock or unrelated errors', async () => {
    const work = jest.fn().mockRejectedValue(new ConflictException('out of stock'));
    await expect(service.withStockRetry(work)).rejects.toThrow('out of stock');
    expect(work).toHaveBeenCalledTimes(1);
  });

  it('UT-INV-13: expires an unpaid reservation and restores aggregated stock in one transaction', async () => {
    await expect(service.expireReservations()).resolves.toBe(1);
    expect(mockPrisma.$queryRaw).toHaveBeenCalled();
    expect(mockPrisma.product.update).toHaveBeenCalledTimes(1);
    expect(mockPrisma.product.update).toHaveBeenCalledWith({
      where: { id: 'p1' }, data: { stock: { increment: 3 }, version: { increment: 1 } },
    });
    expect(mockPrisma.order.update).toHaveBeenCalledWith({
      where: { id: 'o1' }, data: { status: 'CANCELLED', reservationStatus: 'RELEASED', reservationExpiresAt: null },
    });
  });

  it.each([
    { status: 'PAID', reservationStatus: 'CONSUMED' },
    { status: 'CANCELLED', reservationStatus: 'RELEASED' },
    { status: 'PENDING', reservationStatus: 'HELD', reservationExpiresAt: new Date('2099-01-01') },
  ])('UT-INV-14: rechecks the locked order before releasing (%#)', async (changes) => {
    mockPrisma.$queryRaw.mockResolvedValue([{ ...held, ...changes }]);
    await expect(service.expireReservations()).resolves.toBe(0);
    expect(mockPrisma.product.update).not.toHaveBeenCalled();
    expect(mockPrisma.order.update).not.toHaveBeenCalled();
  });

  it('UT-INV-15: runs a background sweep every 30 seconds and stops on shutdown', async () => {
    jest.useFakeTimers();
    try {
      const expire = jest.spyOn(service, 'expireReservations').mockResolvedValue(0);
      service.onModuleInit();
      await jest.advanceTimersByTimeAsync(30000);
      expect(expire).toHaveBeenCalledTimes(2);
      await service.onModuleDestroy();
      await jest.advanceTimersByTimeAsync(30000);
      expect(expire).toHaveBeenCalledTimes(2);
    } finally {
      jest.useRealTimers();
    }
  });

  it.each(['0', '-1', '1.5', 'invalid', '2147484'])('UT-INV-16: rejects invalid TTL %s', (ttl) => {
    const original = process.env.STOCK_RESERVATION_TTL_SECONDS;
    process.env.STOCK_RESERVATION_TTL_SECONDS = ttl;
    try {
      expect(() => new InventoryService(mockPrisma as unknown as PrismaService)).toThrow('STOCK_RESERVATION_TTL_SECONDS');
    } finally {
      if (original === undefined) delete process.env.STOCK_RESERVATION_TTL_SECONDS;
      else process.env.STOCK_RESERVATION_TTL_SECONDS = original;
    }
  });
});
