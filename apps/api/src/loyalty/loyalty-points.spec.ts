import { BadRequestException } from '@nestjs/common';
import { Order, Prisma } from '@prisma/client';
import { awardPaidOrderPoints, calculateLoyaltyPoints } from './loyalty-points';

describe('Loyalty earning', () => {
  it.each([[0, 0], [999, 0], [1000, 1], [1999, 1], [34999, 34], [54000, 54]])(
    'earns %s VND as %s whole points', (amount, expected) => {
      expect(calculateLoyaltyPoints(amount)).toBe(expected);
    },
  );
  it.each([-1, 1000.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])(
    'rejects invalid monetary input %s', (amount) => {
      expect(() => calculateLoyaltyPoints(amount)).toThrow(BadRequestException);
    },
  );

  const order = { id: 'order-1', userId: 'customer-1', status: 'PAID', totalAmount: 34999 } as Order;
  let tx: { loyaltyTransaction: { createMany: jest.Mock }; user: { update: jest.Mock } };
  const client = () => tx as unknown as Prisma.TransactionClient;
  beforeEach(() => {
    tx = { loyaltyTransaction: { createMany: jest.fn().mockResolvedValue({ count: 1 }) }, user: { update: jest.fn() } };
  });

  it('records the earned points and atomically increments the existing customer balance', async () => {
    expect(await awardPaidOrderPoints(client(), order)).toBe(34);
    expect(tx.loyaltyTransaction.createMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({ orderId: order.id, userId: order.userId, points: 34, type: 'EARN' })],
      skipDuplicates: true,
    });
    expect(tx.user.update).toHaveBeenCalledWith({
      where: { id: order.userId }, data: { loyaltyPoints: { increment: 34 } },
    });
  });

  it('does not increment again when the order already has an EARN entry', async () => {
    tx.loyaltyTransaction.createMany.mockResolvedValue({ count: 0 });
    expect(await awardPaidOrderPoints(client(), order)).toBe(0);
    expect(tx.user.update).not.toHaveBeenCalled();
  });

  it.each(['PENDING', 'PAYMENT_FAILED', 'CANCELLED', 'CONFIRMED', 'PREPARING', 'READY', 'COMPLETED'] as const)(
    'does not earn points in %s', async (status) => {
      expect(await awardPaidOrderPoints(client(), { ...order, status })).toBe(0);
      expect(tx.loyaltyTransaction.createMany).not.toHaveBeenCalled();
      expect(tx.user.update).not.toHaveBeenCalled();
    },
  );

  it('allows legacy guest orders and orders below 1,000 VND without a points entry', async () => {
    expect(await awardPaidOrderPoints(client(), { ...order, userId: null })).toBe(0);
    expect(await awardPaidOrderPoints(client(), { ...order, totalAmount: 999 })).toBe(0);
    expect(tx.loyaltyTransaction.createMany).not.toHaveBeenCalled();
    expect(tx.user.update).not.toHaveBeenCalled();
  });

  it('propagates a balance write failure so the surrounding payment transaction rolls back', async () => {
    tx.user.update.mockRejectedValue(new Error('Balance write failed'));
    await expect(awardPaidOrderPoints(client(), order)).rejects.toThrow('Balance write failed');
  });
});
