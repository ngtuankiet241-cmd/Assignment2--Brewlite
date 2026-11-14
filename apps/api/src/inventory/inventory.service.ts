import { ConflictException, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { lockOrder } from '../orders/order-transition';
import { OptimisticStockConflict, releaseStock, reservationExpired } from './stock-reservation';

@Injectable()
export class InventoryService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(InventoryService.name);
  private timer?: ReturnType<typeof setInterval>;
  private sweep?: Promise<unknown>;
  readonly reservationTtlMs: number;

  constructor(private readonly prisma: PrismaService) {
    const ttlSeconds = Number(process.env.STOCK_RESERVATION_TTL_SECONDS ?? 900);
    if (!Number.isSafeInteger(ttlSeconds) || ttlSeconds <= 0 || ttlSeconds > 2147483) {
      throw new Error('STOCK_RESERVATION_TTL_SECONDS must be a positive integer <= 2147483');
    }
    this.reservationTtlMs = ttlSeconds * 1000;
  }

  onModuleInit() {
    this.runSweep();
    this.timer = setInterval(() => this.runSweep(), 30000);
    this.timer.unref();
  }

  async onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    await this.sweep;
  }

  private runSweep() {
    if (this.sweep) return;
    this.sweep = this.expireReservations()
      .catch((error) => this.logger.error('Unable to release expired stock reservations', error.stack))
      .finally(() => { this.sweep = undefined; });
  }

  async withStockRetry<T>(work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        return await this.prisma.$transaction(work);
      } catch (error) {
        const retryable = error instanceof OptimisticStockConflict ||
          (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034');
        if (!retryable) throw error;
        if (attempt === 4) {
          throw new ConflictException('Tồn kho đang được cập nhật. Vui lòng thử đặt hàng lại.');
        }
        await new Promise((resolve) => setTimeout(resolve, 10 * (attempt + 1) + Math.random() * 20));
      }
    }
    throw new Error('Unreachable stock retry state');
  }

  async expireReservations(orderId?: string) {
    const candidates = await this.prisma.order.findMany({
      where: {
        ...(orderId ? { id: orderId } : {}),
        reservationStatus: 'HELD',
        reservationExpiresAt: { lte: new Date() },
        status: { in: ['PENDING', 'PAYMENT_FAILED'] },
      },
      select: { id: true },
      orderBy: { reservationExpiresAt: 'asc' },
      take: 100,
    });
    let released = 0;
    for (const candidate of candidates) {
      released += await this.prisma.$transaction(async (tx) => {
        // Checkout/IPN/cancellation and all sweepers serialize on this same lock.
        const order = await lockOrder(tx, candidate.id);
        if (!reservationExpired(order) || !['PENDING', 'PAYMENT_FAILED'].includes(order.status)) return 0;
        await releaseStock(tx, order);
        await tx.order.update({
          where: { id: order.id },
          data: { status: 'CANCELLED', reservationStatus: 'RELEASED', reservationExpiresAt: null },
        });
        return 1;
      });
    }
    return released;
  }
}
