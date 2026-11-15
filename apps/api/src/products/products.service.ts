import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.product.findMany({
      where: { stock: { gt: 0 } },
      orderBy: { name: 'asc' },
    });
  }

  async findConfiguration() {
    const [sizes, toppings] = await Promise.all([
      this.prisma.drinkSizeOption.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
        select: { id: true, label: true, priceAdjustment: true },
      }),
      this.prisma.toppingOption.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
        select: { id: true, name: true, unitPrice: true },
      }),
    ]);

    return { sizes, toppings };
  }

  async findOne(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
    });

    if (!product) {
      throw new NotFoundException(`Product with ID ${id} was not found`);
    }

    return product;
  }
}
