import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { InventoryService } from '../inventory/inventory.service';
import { assertOrderStatus } from '../orders/order-state-machine';
import { OrdersService } from '../orders/orders.service';
import { PrismaService } from '../prisma/prisma.service';

export interface StaffOrdersQuery {
  status?: unknown;
  page?: unknown;
  limit?: unknown;
}

// Staff need payment progress, without checkout keys or gateway details.
const orderDetails = {
  items: true,
  payment: {
    select: { id: true, amount: true, method: true, status: true, paidAt: true },
  },
} satisfies Prisma.OrderInclude;

function positiveInteger(value: unknown, fallback: number, maximum: number, name: string): number {
  if (value === undefined) return fallback;
  if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value)) {
    throw new BadRequestException(`${name} phải là số nguyên dương.`);
  }
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed > maximum) {
    throw new BadRequestException(`${name} không được vượt quá ${maximum}.`);
  }
  return parsed;
}

@Injectable()
export class StaffService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: InventoryService,
    private readonly orders: OrdersService,
  ) {}

  async getOrders(query: StaffOrdersQuery = {}) {
    const page = positiveInteger(query.page, 1, 2147483647, 'page');
    const limit = positiveInteger(query.limit, 20, 100, 'limit');
    const skip = (page - 1) * limit;
    if (skip > 2147483647) {
      throw new BadRequestException('Vị trí phân trang vượt quá giới hạn.');
    }
    const where: Prisma.OrderWhereInput = {};
    if (query.status !== undefined) {
      assertOrderStatus(query.status);
      where.status = query.status;
    }

    await this.inventory.expireReservations();
    // Count and page share a snapshot while orders are arriving or changing.
    return this.prisma.$transaction(async (tx) => {
      const data = await tx.order.findMany({
        where,
        include: orderDetails,
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        skip,
        take: limit,
      });
      const total = await tx.order.count({ where });
      return { data, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  }

  async getOrder(id: string) {
    await this.inventory.expireReservations(id);
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: orderDetails,
    });
    if (!order) throw new NotFoundException(`Order with id ${id} not found`);
    return order;
  }

  updateOrderStatus(id: string, status: unknown) {
    return this.orders.updateStatus(id, status);
  }
}
