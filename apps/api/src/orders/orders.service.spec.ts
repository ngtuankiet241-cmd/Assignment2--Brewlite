import { Test, TestingModule } from '@nestjs/testing';
import { OrdersService } from './orders.service';
import { PrismaService } from '../prisma/prisma.service';

describe('OrdersService', () => {
  let service: OrdersService;
  let prisma: PrismaService;

  const mockPrisma = {
    order: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
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
});

