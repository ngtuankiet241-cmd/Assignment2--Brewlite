
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';

import { OrderStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { assertOrderStatus } from './order-state-machine';
import {
  changeOrderStatus,
  lockOrder,
} from './order-transition';

export interface CreateOrderItemDto {
  productId: string;
  productName: string;
  unitPrice: number;
  quantity: number;
  size?: string;
  toppings?: string;
  itemTotal: number;
}

export interface CreateOrderDto {
  customerName: string;
  customerPhone: string;
  tableNumber?: number;
  notes?: string;
  items: CreateOrderItemDto[];
}

@Injectable()
export class OrdersService {
  constructor(private readonly prisma: PrismaService) {}

  // 1. Tạo đơn hàng và liên kết với tài khoản đăng nhập
  async create(dto: CreateOrderDto, userId: string) {
    if (!userId) {
      throw new ForbiddenException(
        'Bạn cần đăng nhập để đặt hàng.',
      );
    }

    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException(
        'Đơn hàng phải có ít nhất một sản phẩm.',
      );
    }

    const totalAmount = dto.items.reduce(
      (sum, item) => sum + item.itemTotal,
      0,
    );

    if (
      !Number.isSafeInteger(totalAmount) ||
      totalAmount <= 0
    ) {
      throw new BadRequestException(
        'Tổng tiền đơn hàng không hợp lệ.',
      );
    }

    return this.prisma.order.create({
      data: {
        userId,
        customerName: dto.customerName,
        customerPhone: dto.customerPhone,
        tableNumber: dto.tableNumber,
        notes: dto.notes,
        totalAmount,
        status: OrderStatus.PENDING,
        items: {
          create: dto.items.map((item) => ({
            productId: item.productId,
            productName: item.productName,
            unitPrice: item.unitPrice,
            quantity: item.quantity,
            size: item.size || 'M',
            toppings: item.toppings,
            itemTotal: item.itemTotal,
          })),
        },
      },
      include: {
        items: true,
      },
    });
  }

  // 2. Lấy trạng thái đơn hàng
  async getStatus(id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        totalAmount: true,
        customerName: true,
        updatedAt: true,
      },
    });

    if (!order) {
      throw new NotFoundException(
        `Không tìm thấy đơn hàng ${id}.`,
      );
    }

    return order;
  }

  // 3. Lấy lịch sử đơn hàng của người đang đăng nhập
  async getHistory(userId: string) {
    if (!userId) {
      throw new ForbiddenException(
        'Bạn cần đăng nhập để xem lịch sử đơn hàng.',
      );
    }

    return this.prisma.order.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        items: true,
        payment: true,
        refunds: true,
      },
      take: 20,
    });
  }

  // 4. Cập nhật trạng thái đơn hàng
  async updateStatus(id: string, status: unknown) {
    assertOrderStatus(status);

    return this.prisma.$transaction((tx) =>
      changeOrderStatus(tx, id, status),
    );
  }

  // 5. Nhân viên xem danh sách đơn hàng
  async getStaffOrders() {
    return this.prisma.order.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        items: true,
        payment: true,
        refunds: true,
      },
      take: 100,
    });
  }

  // 6. Nhân viên xác nhận đơn đã thanh toán
  async confirmOrder(id: string) {
    return this.prisma.$transaction((tx) =>
      changeOrderStatus(tx, id, OrderStatus.CONFIRMED),
    );
  }

  // 7. Nhân viên từ chối đơn chưa thanh toán
  async rejectOrder(id: string) {
    return this.prisma.$transaction(async (tx) => {
      const order = await lockOrder(tx, id);

      if (
        order.status !== OrderStatus.PENDING &&
        order.status !== OrderStatus.PAYMENT_FAILED
      ) {
        throw new ConflictException(
          'Đơn đã thanh toán cần được hoàn tiền trước khi hủy.',
        );
      }

      return changeOrderStatus(
        tx,
        id,
        OrderStatus.CANCELLED,
      );
    });
  }

  // 8. Tạo yêu cầu hoàn tiền cho đơn đã thanh toán
  async requestRefund(orderId: string, userId?: string) {
    if (!userId) {
      throw new ForbiddenException(
        'Không xác định được tài khoản đăng nhập.',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const order = await lockOrder(tx, orderId);

      if (!order.userId || order.userId !== userId) {
        throw new ForbiddenException(
          'Bạn không có quyền yêu cầu hoàn tiền cho đơn này.',
        );
      }

      const existingRefund = await tx.refund.findFirst({
        where: { orderId },
        orderBy: { requestedAt: 'desc' },
      });

      if (existingRefund) {
        return {
          message: 'Đơn hàng đã có yêu cầu hoàn tiền.',
          refund: existingRefund,
        };
      }

      if (order.status !== OrderStatus.PAID) {
        throw new ConflictException(
          'Chỉ có thể yêu cầu hoàn tiền khi đơn đang ở trạng thái PAID.',
        );
      }

      const payment = await tx.payment.findUnique({
        where: { orderId },
      });

      if (
        !payment ||
        payment.status !== 'SUCCESS' ||
        !payment.transactionRef
      ) {
        throw new ConflictException(
          'Không tìm thấy giao dịch SePay thanh toán thành công.',
        );
      }

      if (payment.amount !== order.totalAmount) {
        throw new ConflictException(
          'Số tiền thanh toán không khớp với đơn hàng.',
        );
      }

      const refund = await tx.refund.create({
        data: {
          orderId,
          paymentId: payment.id,
          amount: payment.amount,
          status: 'REQUESTED',
          originalTxnRef: payment.transactionRef,
          idempotencyKey: `refund_${payment.id}`,
        },
      });

      return {
        message:
          'Đã ghi nhận yêu cầu hoàn tiền. Chưa gửi yêu cầu đến SePay.',
        refund,
      };
    });
  }

  // 9. Xem trạng thái hoàn tiền
  async getRefund(orderId: string, userId?: string) {
    if (!userId) {
      throw new ForbiddenException(
        'Không xác định được tài khoản đăng nhập.',
      );
    }

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        userId: true,
      },
    });

    if (!order) {
      throw new NotFoundException(
        'Không tìm thấy đơn hàng.',
      );
    }

    if (!order.userId || order.userId !== userId) {
      throw new ForbiddenException(
        'Bạn không có quyền xem yêu cầu hoàn tiền này.',
      );
    }

    return this.prisma.refund.findFirst({
      where: { orderId },
      orderBy: { requestedAt: 'desc' },
    });
  }
}
