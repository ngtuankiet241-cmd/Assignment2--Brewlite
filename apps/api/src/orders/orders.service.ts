import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { assertOrderStatus } from './order-state-machine';
import { changeOrderStatus } from './order-transition';
import { InventoryService } from '../inventory/inventory.service';
import { aggregateQuantities, reserveStock } from '../inventory/stock-reservation';

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
  userId?: string;
  customerName: string;
  customerPhone: string;
  tableNumber?: number;
  notes?: string;
  items: CreateOrderItemDto[];
}

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventory: InventoryService,
  ) {}

  async create(dto: CreateOrderDto) {
    if (!dto || !Array.isArray(dto.items) || dto.items.length === 0) {
      throw new BadRequestException('Order must contain at least one item');
    }

    const quantities = aggregateQuantities(dto.items);
    const totalAmount = dto.items.reduce((sum, item) => sum + item.itemTotal, 0);
    await this.inventory.expireReservations();

    // Retrying reruns the entire transaction, including all product reads.
    return this.inventory.withStockRetry(async (tx) => {
      await reserveStock(tx, quantities);
      return tx.order.create({
        data: {
          userId: dto.userId,
          customerName: dto.customerName,
          customerPhone: dto.customerPhone,
          tableNumber: dto.tableNumber,
          notes: dto.notes,
          totalAmount,
          status: 'PENDING',
          reservationStatus: 'HELD',
          reservationExpiresAt: new Date(Date.now() + this.inventory.reservationTtlMs),
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
    });
  }

  async getStatus(id: string) {
    await this.inventory.expireReservations(id);
    const order = await this.prisma.order.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        totalAmount: true,
        customerName: true,
        updatedAt: true,
        reservationExpiresAt: true,
      },
    });

    if (!order) {
      throw new NotFoundException(`Order with id ${id} not found`);
    }

    return order;
  }

  async getHistory(userId?: string) {
    await this.inventory.expireReservations();
    return this.prisma.order.findMany({
      where: userId ? { userId } : {},
      orderBy: { createdAt: 'desc' },
      include: {
        items: true,
        payment: true,
      },
      take: 20,
    });
  }

  async updateStatus(id: string, status: unknown) {
    assertOrderStatus(status);
    await this.inventory.expireReservations(id);
    return this.prisma.$transaction((tx) => changeOrderStatus(tx, id, status));
  }
}

