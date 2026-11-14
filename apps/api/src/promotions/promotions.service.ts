import { BadRequestException, Injectable } from '@nestjs/common';
import { DiscountType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface ValidatePromotionDto {
  code: string;
  subtotalAmount: number;
}

@Injectable()
export class PromotionsService {
  constructor(private readonly prisma: PrismaService) {}

  async validate(dto: ValidatePromotionDto, db: Pick<Prisma.TransactionClient, 'promotion'> = this.prisma) {
    if (typeof dto?.code !== 'string' || !dto.code.trim()) {
      throw new BadRequestException('Vui lòng nhập mã giảm giá.');
    }
    if (!Number.isSafeInteger(dto.subtotalAmount) || dto.subtotalAmount < 0 || dto.subtotalAmount > 2147483647) {
      throw new BadRequestException('Giá trị đơn hàng phải là số nguyên không âm và không vượt quá 2147483647.');
    }

    const promotion = await db.promotion.findFirst({
      where: { code: { equals: dto.code.trim(), mode: 'insensitive' } },
    });
    if (!promotion) throw new BadRequestException('Mã giảm giá không tồn tại.');
    if (!promotion.isActive) throw new BadRequestException('Mã giảm giá đã bị vô hiệu hóa.');

    const now = new Date();
    if (promotion.validFrom > now) throw new BadRequestException('Mã giảm giá chưa đến thời gian sử dụng.');
    if (promotion.validTo !== null && promotion.validTo <= now) {
      throw new BadRequestException('Mã giảm giá đã hết hạn.');
    }
    if (promotion.discountValue <= 0 || promotion.minOrderValue < 0 ||
        (promotion.discountType === DiscountType.PERCENTAGE && promotion.discountValue > 100) ||
        (promotion.maxDiscount !== null && promotion.maxDiscount <= 0) ||
        (promotion.validTo !== null && promotion.validTo <= promotion.validFrom)) {
      throw new BadRequestException('Cấu hình mã giảm giá không hợp lệ.');
    }
    if (dto.subtotalAmount < promotion.minOrderValue) {
      throw new BadRequestException(`Đơn hàng phải đạt tối thiểu ${promotion.minOrderValue} VND để sử dụng mã này.`);
    }

    const calculated = promotion.discountType === DiscountType.PERCENTAGE
      ? Math.floor(dto.subtotalAmount * promotion.discountValue / 100)
      : promotion.discountValue;
    const discountAmount = Math.min(calculated, promotion.maxDiscount ?? calculated, dto.subtotalAmount);

    return {
      valid: true,
      promotionId: promotion.id,
      code: promotion.code,
      discountType: promotion.discountType,
      discountValue: promotion.discountValue,
      subtotalAmount: dto.subtotalAmount,
      discountAmount,
      totalAmount: dto.subtotalAmount - discountAmount,
    };
  }
}
