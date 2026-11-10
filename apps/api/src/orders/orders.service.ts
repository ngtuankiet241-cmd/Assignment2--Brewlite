import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

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
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateOrderDto) {
    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException('Order must contain at least one item');
    }

    const totalAmount = dto.items.reduce((sum, item) => sum + item.itemTotal, 0);

    // Transaction to create order and items atomically
    return this.prisma.order.create({
      data: {
        userId: dto.userId,
        customerName: dto.customerName,
        customerPhone: dto.customerPhone,
        tableNumber: dto.tableNumber,
        notes: dto.notes,
        totalAmount,
        status: 'PENDING',
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
      throw new NotFoundException(`Order with id ${id} not found`);
    }

    return order;
  }

  async getHistory(userId?: string) {
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

  async updateStatus(id: string, status: any) {
    const order = await this.prisma.order.findUnique({ where: { id } });
    if (!order) {
      throw new NotFoundException(`Order with id ${id} not found`);
    }

    return this.prisma.order.update({
      where: { id },
      data: { status },
    });
  }
}

