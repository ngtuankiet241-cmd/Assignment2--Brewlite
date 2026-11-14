import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { OrderStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { changeOrderStatus, lockOrder } from '../orders/order-transition';
import { InventoryService } from '../inventory/inventory.service';
import { assertReservationActive } from '../inventory/stock-reservation';

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
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: InventoryService,
  ) {}

  async createCheckout(dto: CreatePaymentCheckoutDto) {
    await this.inventory.expireReservations(dto.orderId);
    return this.prisma.$transaction(async (tx) => {
      const order = await lockOrder(tx, dto.orderId);
      assertReservationActive(order);
      if (!Number.isSafeInteger(dto.amount) || dto.amount !== order.totalAmount) {
        throw new BadRequestException('Số tiền thanh toán phải khớp tổng tiền sau giảm giá của đơn hàng.');
      }

      if (dto.idempotencyKey) {
        const existing = await tx.payment.findUnique({
          where: { idempotencyKey: dto.idempotencyKey },
        });
        if (existing) {
          if (existing.orderId !== order.id) {
            throw new ConflictException('Idempotency key đã được sử dụng cho đơn hàng khác.');
          }
          return existing;
        }
      }

      if (order.status === OrderStatus.PAYMENT_FAILED) {
        await changeOrderStatus(tx, order.id, OrderStatus.PENDING);
      } else if (order.status !== OrderStatus.PENDING) {
        throw new ConflictException(`Không thể tạo thanh toán cho đơn ở trạng thái ${order.status}.`);
      }

      const transactionRef = `SEPAY_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      const qrUrl = `https://qr.sepay.vn/img?acc=BREWLITE&bank=MBBank&amount=${order.totalAmount}&des=${transactionRef}`;

      return tx.payment.upsert({
        where: { orderId: dto.orderId },
        update: {
          amount: order.totalAmount,
          transactionRef,
          idempotencyKey: dto.idempotencyKey,
          qrUrl,
          status: 'PENDING',
          paidAt: null,
        },
        create: {
          orderId: dto.orderId,
          amount: order.totalAmount,
          transactionRef,
          idempotencyKey: dto.idempotencyKey,
          qrUrl,
          status: 'PENDING',
        },
      });
    });
  }

  async handleWebhookIpn(payload: SepayWebhookPayload) {
    if (payload?.status !== 'SUCCESS' && payload?.status !== 'FAILED') {
      throw new BadRequestException('Trạng thái thanh toán không hợp lệ.');
    }

    await this.inventory.expireReservations(payload.orderId);
    return this.prisma.$transaction(async (tx) => {
      const order = await lockOrder(tx, payload.orderId);
      const payment = await tx.payment.findUnique({ where: { orderId: order.id } });
      if (!payment) throw new NotFoundException(`Payment for order ${order.id} not found`);
      if (!Number.isSafeInteger(payload.amount) || payload.amount !== order.totalAmount || payload.amount !== payment.amount) {
        throw new BadRequestException('Số tiền giao dịch không khớp số tiền cần thanh toán.');
      }

      // An exact replay is a no-op, even after preparation or completion.
      if (payment.status === payload.status && payment.transactionRef === payload.transactionRef &&
          payment.amount === payload.amount) {
        return payment;
      }
      if (payment.status === 'SUCCESS') {
        throw new ConflictException('Không thể thay đổi giao dịch đã thanh toán thành công.');
      }

      const isSuccess = payload.status === 'SUCCESS';
      await changeOrderStatus(tx, order.id, isSuccess ? OrderStatus.PAID : OrderStatus.PAYMENT_FAILED);
      return tx.payment.update({
        where: { orderId: payload.orderId },
        data: {
          status: isSuccess ? 'SUCCESS' : 'FAILED',
          transactionRef: payload.transactionRef,
          paidAt: isSuccess ? new Date() : null,
        },
      });
    }).catch((error) => {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Mã giao dịch thanh toán đã được sử dụng.');
      }
      throw error;
    });
  }
}

