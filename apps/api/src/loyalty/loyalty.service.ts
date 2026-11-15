import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { LOYALTY_VND_PER_POINT, LOYALTY_REDEMPTION_VND_PER_POINT } from './loyalty-points';

@Injectable()
export class LoyaltyService {
  constructor(private readonly prisma: PrismaService) {}

  async getAccount(userId: string) {
    if (typeof userId !== 'string' || !userId) {
      throw new UnauthorizedException('Không xác định được tài khoản đăng nhập.');
    }
    // The balance and ledger must describe the same snapshot during payments.
    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: userId }, select: { loyaltyPoints: true },
      });
      if (!user) throw new NotFoundException('Không tìm thấy tài khoản điểm thưởng.');
      const transactions = await tx.loyaltyTransaction.findMany({
        where: { userId },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 20,
        select: { id: true, orderId: true, type: true, points: true, description: true, createdAt: true },
      });
      return { loyaltyPoints: user.loyaltyPoints, vndPerPoint: LOYALTY_VND_PER_POINT,
        redemptionVndPerPoint: LOYALTY_REDEMPTION_VND_PER_POINT, transactions };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  }
}
