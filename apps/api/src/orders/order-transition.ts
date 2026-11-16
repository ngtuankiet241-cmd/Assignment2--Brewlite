
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

import {
  assertReservationActive,
  releaseStock,
} from '../inventory/stock-reservation';
import { awardPaidOrderPoints, restoreRedeemedOrderPoints } from '../loyalty/loyalty-points';

// Khóa đơn hàng để tránh cập nhật đồng thời.
// Mọi thao tác chuyển trạng thái phải dùng cùng cơ chế khóa.
export async function lockOrder(
  tx: Prisma.TransactionClient,
  id: string,
): Promise<Order> {
  const orders = await tx.$queryRaw<Order[]>`
    SELECT * FROM "Order" WHERE "id" = ${id} FOR UPDATE
  `;

  if (!orders.length) {
    throw new NotFoundException('Không tìm thấy đơn hàng.');
  }

  return orders[0];
}

// Chuyển trạng thái đơn hàng.
// Kết hợp quản lý tồn kho và kiểm tra yêu cầu hoàn tiền.
export async function changeOrderStatus(
  tx: Prisma.TransactionClient,
  id: string,
  status: unknown,
) {
  assertOrderStatus(status);

  const order = await lockOrder(tx, id);
  assertTransition(order.status, status);

  // Không cho chuẩn bị đơn đang có yêu cầu hoàn tiền.
  if (
    (order.status === OrderStatus.PAID || order.status === OrderStatus.CONFIRMED) &&
    status === OrderStatus.PREPARING
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

  const data: Prisma.OrderUpdateInput = {
    status,
  };

  if (
    (order.status === OrderStatus.PAID || order.status === OrderStatus.CONFIRMED) &&
    status === OrderStatus.CANCELLED
  ) {
    const payment = await tx.payment.findUnique({ where: { orderId: id } });
    if (payment?.status === 'SUCCESS' && payment.amount > 0 && payment.transactionRef) {
      await tx.refund.upsert({
        where: { idempotencyKey: `refund_${payment.id}` },
        update: {},
        create: {
          orderId: id,
          paymentId: payment.id,
          amount: payment.amount,
          status: 'REQUESTED',
          originalTxnRef: payment.transactionRef,
          idempotencyKey: `refund_${payment.id}`,
        },
      });
    }
  }

  // Khi hủy đơn, giải phóng tồn kho theo logic của main.
  if (status === OrderStatus.CANCELLED && order.reservationStatus) {
    await releaseStock(tx, order);

    data.reservationStatus = 'RELEASED';
    data.reservationExpiresAt = null;
  } else {
    assertReservationActive(order);

    // Khi thanh toán thành công, chuyển tồn kho từ HELD sang CONSUMED.
    if (
      status === OrderStatus.PAID &&
      order.reservationStatus === 'HELD'
    ) {
      data.reservationStatus = 'CONSUMED';
      data.reservationExpiresAt = null;
    }
  }

  const updatedOrder = await tx.order.update({
    where: { id },
    data,
  });
  if (status === OrderStatus.PAID) {
    await awardPaidOrderPoints(tx, updatedOrder);
  }
  if (status === OrderStatus.CANCELLED) {
    await restoreRedeemedOrderPoints(tx, order);
  }
  return updatedOrder;
}

// Hoàn tất hủy đơn sau khi có xác nhận hoàn tiền thật từ SePay.
// Không sử dụng hàm này để hoàn tất giao dịch Demo.
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

  const data: Prisma.OrderUpdateInput = {
    status: OrderStatus.CANCELLED,
  };

  // Đồng bộ xử lý tồn kho khi hủy đơn.
  if (order.reservationStatus) {
    await releaseStock(tx, order);

    data.reservationStatus = 'RELEASED';
    data.reservationExpiresAt = null;
  }

  const cancelled = await tx.order.update({
    where: { id: orderId },
    data,
  });
  await restoreRedeemedOrderPoints(tx, order);
  return cancelled;
}
