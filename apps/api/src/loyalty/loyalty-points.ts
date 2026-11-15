import { BadRequestException } from '@nestjs/common';
import { Order, Prisma } from '@prisma/client';

export const LOYALTY_VND_PER_POINT = 1000;

export function calculateLoyaltyPoints(totalAmount: number): number {
  if (!Number.isSafeInteger(totalAmount) || totalAmount < 0) {
    throw new BadRequestException('Số tiền tính điểm phải là số nguyên không âm.');
  }
  return Math.floor(totalAmount / LOYALTY_VND_PER_POINT);
}

// Called inside the transaction that changes the locked order to PAID.
export async function awardPaidOrderPoints(
  tx: Prisma.TransactionClient,
  order: Pick<Order, 'id' | 'userId' | 'status' | 'totalAmount'>,
): Promise<number> {
  if (order.status !== 'PAID' || !order.userId) return 0;
  const points = calculateLoyaltyPoints(order.totalAmount);
  if (points === 0) return 0;

  // A partial unique index permits at most one EARN per order. Only the caller
  // that inserts the ledger entry may increment the balance, even under retries.
  const inserted = await tx.loyaltyTransaction.createMany({
    data: [{
      userId: order.userId,
      orderId: order.id,
      type: 'EARN',
      points,
      description: `Tích điểm thanh toán đơn ${order.id}`,
    }],
    skipDuplicates: true,
  });
  if (inserted.count === 0) return 0;
  await tx.user.update({
    where: { id: order.userId },
    data: { loyaltyPoints: { increment: points } },
  });
  return points;
}
