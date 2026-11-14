
import { NotFoundException } from '@nestjs/common';
import { ProductsService } from './products.service';
import { PrismaService } from '../prisma/prisma.service';

describe('ProductsService', () => {
  let service: ProductsService;

  const mockPrismaService = {
    product: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    drinkSizeOption: { findMany: jest.fn() },
    toppingOption: { findMany: jest.fn() },
  };

  beforeEach(() => {
    jest.clearAllMocks();

    service = new ProductsService(
      mockPrismaService as unknown as PrismaService,
    );
  });

  it('should return available products', async () => {
    const products = [
      {
        id: 'p1',
        name: 'Coffee',
        description: 'Milk coffee',
        price: 35000,
        imageUrl: 'coffee.jpg',
        stock: 10,
      },
    ];

    mockPrismaService.product.findMany.mockResolvedValue(products);

    const result = await service.findAll();

    expect(result).toEqual(products);
    expect(mockPrismaService.product.findMany).toHaveBeenCalledWith({
      where: { stock: { gt: 0 } },
      orderBy: { name: 'asc' },
    });
  });

  it('should return a product by id', async () => {
    const product = {
      id: 'p1',
      name: 'Coffee',
      description: 'Milk coffee',
      price: 35000,
      imageUrl: 'coffee.jpg',
      stock: 10,
    };

    mockPrismaService.product.findUnique.mockResolvedValue(product);

    const result = await service.findOne('p1');

    expect(result).toEqual(product);
    expect(mockPrismaService.product.findUnique).toHaveBeenCalledWith({
      where: { id: 'p1' },
    });
  });

  it('should return active size and topping options in configured order', async () => {
    const sizes = [{ id: 'M', label: 'Vừa', priceAdjustment: 0 }];
    const toppings = [{ id: 'pearls', name: 'Trân châu đen', unitPrice: 7000 }];
    mockPrismaService.drinkSizeOption.findMany.mockResolvedValue(sizes);
    mockPrismaService.toppingOption.findMany.mockResolvedValue(toppings);

    await expect(service.findConfiguration()).resolves.toEqual({ sizes, toppings });
    expect(mockPrismaService.drinkSizeOption.findMany).toHaveBeenCalledWith({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      select: { id: true, label: true, priceAdjustment: true },
    });
    expect(mockPrismaService.toppingOption.findMany).toHaveBeenCalledWith({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      select: { id: true, name: true, unitPrice: true },
    });
  });

  it('should throw NotFoundException if product does not exist', async () => {
    mockPrismaService.product.findUnique.mockResolvedValue(null);

    await expect(service.findOne('unknown')).rejects.toThrow(
      NotFoundException,
    );
  });
});
