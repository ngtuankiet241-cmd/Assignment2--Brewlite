import {
  ConflictException,
  NotFoundException,
} from '@nestjs/common';

import {
  Order,
  OrderStatus,
  Prisma,
} from '@prisma/client';

import {
  assertOrderStatus,
  assertTransition,
} from './order-state-machine';

// Khóa đơn hàng để tránh cập nhật đồng thời
export async function lockOrder(
  tx: Prisma.TransactionClient,
  id: string,
): Promise<Order> {
  const orders = await tx.$queryRaw<Order[]>`
    SELECT * FROM "Order" WHERE "id" = ${id} FOR UPDATE
  `;

  if (!orders[0]) {
    throw new NotFoundException(
      `Order with id ${id} not found`,
    );
  }

  return orders[0];
}

// Chuyển trạng thái đơn hàng
export async function changeOrderStatus(
  tx: Prisma.TransactionClient,
  id: string,
  status: unknown,
) {
  assertOrderStatus(status);

  const order = await lockOrder(tx, id);
  assertTransition(order.status, status);

  // Không cho xác nhận đơn đang có yêu cầu hoàn tiền
  if (
    order.status === OrderStatus.PAID &&
    status === OrderStatus.CONFIRMED
  ) {
    const refund = await tx.refund.findFirst({
      where: {
        orderId: id,
        status: {
          in: ['REQUESTED', 'PENDING', 'SUCCEEDED'],
        },
      },
    });

    if (refund) {
      throw new ConflictException(
        'Đơn hàng đang hoặc đã được xử lý hoàn tiền.',
      );
    }
  }

  return tx.order.update({
    where: { id },
    data: { status },
  });
}

// Hoàn tất hủy đơn sau khi hoàn tiền thành công
export async function finalizeRefundCancellation(
  tx: Prisma.TransactionClient,
  orderId: string,
) {
  const order = await lockOrder(tx, orderId);

  if (order.status !== OrderStatus.PAID) {
    throw new ConflictException(
      'Đơn hàng không ở trạng thái cho phép hoàn tiền.',
    );
  }

  const payment = await tx.payment.findUnique({
    where: { orderId },
  });

  if (!payment || payment.status !== 'SUCCESS') {
    throw new ConflictException(
      'Không tìm thấy thanh toán thành công.',
    );
  }

  const refund = await tx.refund.findFirst({
    where: {
      orderId,
      paymentId: payment.id,
      status: 'SUCCEEDED',
      amount: payment.amount,
      sepayRefundId: { not: null },
    },
  });

  if (!refund) {
    throw new ConflictException(
      'SePay chưa xác nhận hoàn tiền thành công.',
    );
  }

  return tx.order.update({
    where: { id: orderId },
    data: { status: OrderStatus.CANCELLED },
  });
}