import { BadRequestException } from '@nestjs/common';
import { DiscountType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PromotionsService } from './promotions.service';

describe('Promotion validity and monetary rules', () => {
  const now = new Date('2026-11-14T00:00:00Z');
  const prisma = { promotion: { findFirst: jest.fn() } };
  let service: PromotionsService;
  const promotion = {
    id: 'promo-1', code: 'BREW10', discountType: DiscountType.PERCENTAGE, discountValue: 10,
    minOrderValue: 50000, maxDiscount: null, isActive: true,
    validFrom: new Date('2026-11-01T00:00:00Z'), validTo: null,
  };

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(now);
    jest.resetAllMocks();
    prisma.promotion.findFirst.mockResolvedValue({ ...promotion });
    service = new PromotionsService(prisma as unknown as PrismaService);
  });
  afterEach(() => { jest.useRealTimers(); });

  it('UT-PROMO-01: accepts the exact minimum amount and start time', async () => {
    prisma.promotion.findFirst.mockResolvedValue({ ...promotion, validFrom: now });
    await expect(service.validate({ code: 'BREW10', subtotalAmount: 50000 })).resolves.toMatchObject({
      discountAmount: 5000, totalAmount: 45000,
    });
  });

  it('UT-PROMO-02: expires at the exact end time', async () => {
    prisma.promotion.findFirst.mockResolvedValue({ ...promotion, validTo: now });
    await expect(service.validate({ code: 'BREW10', subtotalAmount: 50000 })).rejects.toThrow('hết hạn');
  });

  it('UT-PROMO-03: floors fractional VND and applies the configured cap', async () => {
    prisma.promotion.findFirst.mockResolvedValue({ ...promotion, minOrderValue: 0, discountValue: 33 });
    await expect(service.validate({ code: 'BREW10', subtotalAmount: 10005 })).resolves.toMatchObject({
      discountAmount: 3301, totalAmount: 6704,
    });
    prisma.promotion.findFirst.mockResolvedValue({ ...promotion, maxDiscount: 3000 });
    await expect(service.validate({ code: 'BREW10', subtotalAmount: 100000 })).resolves.toMatchObject({
      discountAmount: 3000, totalAmount: 97000,
    });
  });

  it('UT-PROMO-04: a fixed discount never makes the order total negative', async () => {
    prisma.promotion.findFirst.mockResolvedValue({ ...promotion, discountType: DiscountType.FIXED_AMOUNT, discountValue: 100000 });
    await expect(service.validate({ code: 'BREW10', subtotalAmount: 50000 })).resolves.toMatchObject({
      discountAmount: 50000, totalAmount: 0,
    });
  });

  it.each([undefined, null, '', ' ', 123, {}, []])('UT-PROMO-05: malformed code (%#) is rejected', async (code) => {
    await expect(service.validate({ code: code as string, subtotalAmount: 50000 })).rejects.toThrow(BadRequestException);
    expect(prisma.promotion.findFirst).not.toHaveBeenCalled();
  });

  it.each([undefined, null, -1, 1.5, '50000', NaN, Infinity, 2147483648])
    ('UT-PROMO-06: malformed subtotal (%#) is rejected', async (subtotalAmount) => {
      await expect(service.validate({ code: 'BREW10', subtotalAmount: subtotalAmount as number }))
        .rejects.toThrow(BadRequestException);
      expect(prisma.promotion.findFirst).not.toHaveBeenCalled();
    });
});
