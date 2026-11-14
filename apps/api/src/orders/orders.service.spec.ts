import { Test, TestingModule } from '@nestjs/testing';
import { OrdersService } from './orders.service';
import { PrismaService } from '../prisma/prisma.service';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { OrderStatus } from '@prisma/client';
import { InventoryService } from '../inventory/inventory.service';

describe('OrdersService', () => {
  let service: OrdersService;
  let prisma: PrismaService;

  const mockPrisma = {
    $queryRaw: jest.fn(),
    $transaction: jest.fn(),
    order: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    product: { findMany: jest.fn(), updateMany: jest.fn() },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockPrisma.$transaction.mockImplementation((work) => work(mockPrisma));
    mockPrisma.product.findMany.mockResolvedValue([{ id: 'p1', name: 'Coffee', stock: 10, version: 0 }]);
    mockPrisma.product.updateMany.mockResolvedValue({ count: 1 });
    mockPrisma.$queryRaw.mockResolvedValue([{ id: 'ord-123', status: OrderStatus.PENDING }]);
    mockPrisma.order.update.mockImplementation(({ where, data }) => Promise.resolve({ id: where.id, ...data }));
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        {
          provide: InventoryService,
          useValue: {
            reservationTtlMs: 900000,
            expireReservations: jest.fn().mockResolvedValue(0),
            withStockRetry: (work) => mockPrisma.$transaction(work),
          },
        },
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
      ],
    }).compile();

    service = module.get<OrdersService>(OrdersService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('UT-ORD-01: creates an order with calculated total', async () => {
      const dto = {
        customerName: 'Kiệt',
        customerPhone: '0901234567',
        tableNumber: 3,
        items: [
          {
            productId: 'p1',
            productName: 'Cà phê Muối',
            unitPrice: 35000,
            quantity: 2,
            itemTotal: 70000,
          },
        ],
      };

      const createdOrder = { id: 'ord-123', totalAmount: 70000, ...dto };
      mockPrisma.order.create.mockResolvedValue(createdOrder);

      const result = await service.create(dto);
      expect(result).toEqual(createdOrder);
      expect(mockPrisma.order.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            totalAmount: 70000,
            status: 'PENDING',
          }),
        }),
      );
    });

    it('UT-ORD-02: throws error when items array is empty', async () => {
      await expect(
        service.create({
          customerName: 'Kiệt',
          customerPhone: '0901234567',
          items: [],
        }),
      ).rejects.toThrow('Order must contain at least one item');
    });
  });

  describe('getStatus', () => {
    it('UT-ORD-03: returns order status when order exists', async () => {
      mockPrisma.order.findUnique.mockResolvedValue({
        id: 'ord-123',
        status: 'PAID',
        totalAmount: 70000,
      });

      const result = await service.getStatus('ord-123');
      expect(result.status).toEqual('PAID');
    });
  });

  describe('updateStatus', () => {
    it('UT-ORD-04: updates an allowed transition inside a transaction', async () => {
      await expect(service.updateStatus('ord-123', 'PAID')).resolves.toMatchObject({ status: 'PAID' });
      expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
      expect(mockPrisma.order.update).toHaveBeenCalledWith({ where: { id: 'ord-123' }, data: { status: 'PAID' } });
    });

    it.each([
      ['PENDING', 'COMPLETED'], ['COMPLETED', 'PREPARING'], ['CANCELLED', 'PAID'],
      ['PAID', 'PAYMENT_FAILED'], ['READY', 'READY'],
    ])('UT-ORD-05: rejects %s -> %s before writing', async (from, to) => {
      mockPrisma.$queryRaw.mockResolvedValue([{ id: 'ord-123', status: from }]);
      await expect(service.updateStatus('ord-123', to)).rejects.toThrow(ConflictException);
      expect(mockPrisma.order.update).not.toHaveBeenCalled();
    });

    it('UT-ORD-06: rejects unknown status before opening a transaction', async () => {
      await expect(service.updateStatus('ord-123', 'SHIPPED')).rejects.toThrow(BadRequestException);
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it('UT-ORD-07: returns 404 for a missing order without writing', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([]);
      await expect(service.updateStatus('missing', 'PAID')).rejects.toThrow(NotFoundException);
      expect(mockPrisma.order.update).not.toHaveBeenCalled();
    });
  });
});

