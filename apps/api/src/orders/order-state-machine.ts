import { BadRequestException, ConflictException } from '@nestjs/common';
import { OrderStatus } from '@prisma/client';

const transitions: Readonly<Record<OrderStatus, readonly OrderStatus[]>> = {
  PENDING: [OrderStatus.PAID, OrderStatus.PAYMENT_FAILED, OrderStatus.CANCELLED],
  PAYMENT_FAILED: [OrderStatus.PENDING, OrderStatus.CANCELLED],
  PAID: [OrderStatus.PREPARING, OrderStatus.CANCELLED],
  PREPARING: [OrderStatus.READY],
  READY: [OrderStatus.COMPLETED],
  COMPLETED: [],
  CANCELLED: [],
};

export function assertOrderStatus(value: unknown): asserts value is OrderStatus {
  if (typeof value !== 'string' || !Object.values(OrderStatus).includes(value as OrderStatus)) {
    throw new BadRequestException('Trạng thái đơn hàng không hợp lệ.');
  }
}

export function assertTransition(from: OrderStatus, to: unknown): asserts to is OrderStatus {
  assertOrderStatus(to);
  if (!transitions[from].includes(to)) {
    throw new ConflictException({
      statusCode: 409,
      message: `Không thể chuyển đơn hàng từ ${from} sang ${to}.`,
      currentStatus: from,
      requestedStatus: to,
      allowedTransitions: transitions[from],
    });
  }
}
