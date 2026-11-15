import { BadRequestException } from '@nestjs/common';
import { Order, Prisma } from '@prisma/client';

export const LOYALTY_VND_PER_POINT = 1000;
export const LOYALTY_REDEMPTION_VND_PER_POINT = 100;

export function calculateRedemption(points: unknown, amountAfterPromotion: number): number {
  if (!Number.isSafeInteger(points) || (points as number) < 0 ||
      !Number.isSafeInteger(amountAfterPromotion) || amountAfterPromotion < 0) {
    throw new BadRequestException('Số điểm sử dụng phải là số nguyên không âm.');
  }
  const discount = (points as number) * LOYALTY_REDEMPTION_VND_PER_POINT;
  if (!Number.isSafeInteger(discount) || discount > amountAfterPromotion) {
    throw new BadRequestException('Số điểm sử dụng vượt quá giá trị cần thanh toán.');
  }
  return discount;
}

export async function redeemOrderPoints(
  tx: Prisma.TransactionClient,
  order: Pick<Order, 'id' | 'userId' | 'redeemedPoints'>,
) {
  if (!order.redeemedPoints) return;
  if (!order.userId) throw new BadRequestException('Vui lòng đăng nhập để sử dụng điểm.');
  // The conditional debit serializes competing checkouts on the customer row.
  const debited = await tx.user.updateMany({
    where: { id: order.userId, loyaltyPoints: { gte: order.redeemedPoints } },
    data: { loyaltyPoints: { decrement: order.redeemedPoints } },
  });
  if (debited.count !== 1) throw new BadRequestException('Bạn không đủ điểm thưởng. Vui lòng cập nhật số dư và thử lại.');
  await tx.loyaltyTransaction.create({ data: {
    userId: order.userId, orderId: order.id, type: 'REDEEM', points: order.redeemedPoints,
    description: `Sử dụng điểm cho đơn ${order.id}`,
  } });
}

// The caller holds the order lock; the unique ledger key also protects replays.
export async function restoreRedeemedOrderPoints(
  tx: Prisma.TransactionClient,
  order: Pick<Order, 'id' | 'userId' | 'redeemedPoints'>,
) {
  if (!order.userId || !order.redeemedPoints) return;
  const restored = await tx.loyaltyTransaction.createMany({ data: [{
    userId: order.userId, orderId: order.id, type: 'REFUND', points: order.redeemedPoints,
    description: `Hoàn điểm cho đơn đã hủy ${order.id}`,
  }], skipDuplicates: true });
  if (restored.count === 1) await tx.user.update({
    where: { id: order.userId }, data: { loyaltyPoints: { increment: order.redeemedPoints } },
  });
}

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
