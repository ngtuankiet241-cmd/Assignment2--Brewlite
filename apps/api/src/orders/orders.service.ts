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
import { changeOrderStatus, lockOrder } from './order-transition';
import { InventoryService } from '../inventory/inventory.service';
import { aggregateQuantities, reserveStock } from '../inventory/stock-reservation';
import { PromotionsService } from '../promotions/promotions.service';
import { priceOrderItems } from './order-pricing';
import { withIdempotency } from '../common/idempotency';

export interface CreateOrderItemDto {
  productId: string;
  productName?: string;
  unitPrice?: number;
  quantity: number;
  size?: string;
  toppings?: string;
  itemTotal?: number;
}

export interface CreateOrderDto {
  customerName: string;
  customerPhone: string;
  tableNumber?: number;
  notes?: string;
  promotionCode?: string;
  items: CreateOrderItemDto[];
}

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: InventoryService,
    private readonly promotions: PromotionsService,
  ) {}

  // Giá, khuyến mãi và giữ tồn kho được tính từ dữ liệu phía máy chủ;
  // userId chỉ lấy từ phiên đăng nhập đã xác thực.
  async create(dto: CreateOrderDto, userId: string, idempotencyKey?: string) {
    if (!userId) {
      throw new ForbiddenException('Bạn cần đăng nhập để đặt hàng.');
    }
    if (!dto || !Array.isArray(dto.items) || dto.items.length === 0) {
      throw new BadRequestException('Đơn hàng phải có ít nhất một sản phẩm.');
    }

    const quantities = aggregateQuantities(dto.items);
    await this.inventory.expireReservations();

    // Retrying reruns the entire transaction, including all product reads.
    return this.inventory.withStockRetry((tx) => withIdempotency(tx, 'POST /orders', idempotencyKey, { userId, payload: dto }, async () => {
      const products = await reserveStock(tx, quantities);
      const [sizes, toppings] = await Promise.all([
        tx.drinkSizeOption.findMany({ where: { isActive: true } }),
        tx.toppingOption.findMany({ where: { isActive: true } }),
      ]);

      const { items, subtotalAmount } = priceOrderItems(
        dto.items,
        products,
        sizes,
        toppings,
      );
      const promotion =
        dto.promotionCode === undefined
          ? undefined
          : await this.promotions.validate(
              { code: dto.promotionCode, subtotalAmount },
              tx,
            );

      return tx.order.create({
        data: {
          userId,
          customerName: dto.customerName,
          customerPhone: dto.customerPhone,
          tableNumber: dto.tableNumber,
          notes: dto.notes,
          subtotalAmount,
          discountAmount: promotion?.discountAmount ?? 0,
          totalAmount: promotion?.totalAmount ?? subtotalAmount,
          promotionId: promotion?.promotionId,
          promotionCode: promotion?.code,
          status: OrderStatus.PENDING,
          reservationStatus: 'HELD',
          reservationExpiresAt: new Date(
            Date.now() + this.inventory.reservationTtlMs,
          ),
          items: { create: items },
        },
        include: { items: true },
      });
    }));
  }

  async getStatus(id: string) {
    await this.inventory.expireReservations(id);
    const order = await this.prisma.order.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        totalAmount: true,
        subtotalAmount: true,
        discountAmount: true,
        promotionCode: true,
        customerName: true,
        updatedAt: true,
        reservationExpiresAt: true,
      },
    });
    if (!order) {
      throw new NotFoundException(`Không tìm thấy đơn hàng ${id}.`);
    }
    return order;
  }

  async getHistory(userId: string) {
    if (!userId) {
      throw new ForbiddenException(
        'Bạn cần đăng nhập để xem lịch sử đơn hàng.',
      );
    }
    await this.inventory.expireReservations();
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

  async updateStatus(id: string, status: unknown) {
    assertOrderStatus(status);
    await this.inventory.expireReservations(id);
    return this.prisma.$transaction((tx) =>
      changeOrderStatus(tx, id, status),
    );
  }

  async getStaffOrders() {
    return this.prisma.order.findMany({
      orderBy: { createdAt: 'desc' },
      include: { items: true, payment: true, refunds: true },
      take: 100,
    });
  }

  async confirmOrder(id: string) {
    await this.inventory.expireReservations(id);
    return this.prisma.$transaction((tx) =>
      changeOrderStatus(tx, id, OrderStatus.CONFIRMED),
    );
  }

  async rejectOrder(id: string) {
    await this.inventory.expireReservations(id);
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
      return changeOrderStatus(tx, id, OrderStatus.CANCELLED);
    });
  }

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
      const payment = await tx.payment.findUnique({ where: { orderId } });
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
        message: 'Đã ghi nhận yêu cầu hoàn tiền. Chưa gửi yêu cầu đến SePay.',
        refund,
      };
    });
  }

  async getRefund(orderId: string, userId?: string) {
    if (!userId) {
      throw new ForbiddenException(
        'Không xác định được tài khoản đăng nhập.',
      );
    }
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { id: true, userId: true },
    });
    if (!order) {
      throw new NotFoundException('Không tìm thấy đơn hàng.');
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
