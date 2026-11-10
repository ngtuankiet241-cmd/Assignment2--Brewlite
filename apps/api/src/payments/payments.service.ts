import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface CreatePaymentCheckoutDto {
  orderId: string;
  amount: number;
  idempotencyKey?: string;
}

export interface SepayWebhookPayload {
  orderId: string;
  transactionRef: string;
  amount: number;
  status: 'SUCCESS' | 'FAILED';
}

@Injectable()
export class PaymentsService {
  constructor(private readonly prisma: PrismaService) {}

  async createCheckout(dto: CreatePaymentCheckoutDto) {
    const order = await this.prisma.order.findUnique({
      where: { id: dto.orderId },
    });

    if (!order) {
      throw new NotFoundException(`Order with id ${dto.orderId} not found`);
    }

    // Idempotency check (FR-21 / ADR-004)
    if (dto.idempotencyKey) {
      const existing = await this.prisma.payment.findUnique({
        where: { idempotencyKey: dto.idempotencyKey },
      });
      if (existing) {
        return existing;
      }
    }

    const transactionRef = `SEPAY_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const qrUrl = `https://qr.sepay.vn/img?acc=BREWLITE&bank=MBBank&amount=${dto.amount}&des=${transactionRef}`;

    return this.prisma.payment.upsert({
      where: { orderId: dto.orderId },
      update: {
        amount: dto.amount,
        transactionRef,
        idempotencyKey: dto.idempotencyKey,
        qrUrl,
        status: 'PENDING',
      },
      create: {
        orderId: dto.orderId,
        amount: dto.amount,
        transactionRef,
        idempotencyKey: dto.idempotencyKey,
        qrUrl,
        status: 'PENDING',
      },
    });
  }

  async handleWebhookIpn(payload: SepayWebhookPayload) {
    const payment = await this.prisma.payment.findUnique({
      where: { orderId: payload.orderId },
    });

    if (!payment) {
      throw new NotFoundException(`Payment for order ${payload.orderId} not found`);
    }

    const isSuccess = payload.status === 'SUCCESS';

    // Atomically update payment and order status
    return this.prisma.$transaction(async (tx) => {
      const updatedPayment = await tx.payment.update({
        where: { orderId: payload.orderId },
        data: {
          status: isSuccess ? 'SUCCESS' : 'FAILED',
          transactionRef: payload.transactionRef,
          paidAt: isSuccess ? new Date() : null,
        },
      });

      if (isSuccess) {
        await tx.order.update({
          where: { id: payload.orderId },
          data: { status: 'PAID' },
        });
      }

      return updatedPayment;
    });
  }
}
