import { Test, TestingModule } from '@nestjs/testing';
import { PaymentsService } from './payments.service';
import { PrismaService } from '../prisma/prisma.service';

describe('PaymentsService', () => {
  let service: PaymentsService;
  let prisma: PrismaService;

  const mockPrisma = {
    order: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    payment: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
      ],
    }).compile();

    service = module.get<PaymentsService>(PaymentsService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createCheckout', () => {
    it('UT-PAY-01: generates payment checkout with SePay QR', async () => {
      mockPrisma.order.findUnique.mockResolvedValue({ id: 'ord-123', totalAmount: 70000 });
      mockPrisma.payment.upsert.mockResolvedValue({
        id: 'pay-1',
        orderId: 'ord-123',
        amount: 70000,
        status: 'PENDING',
        qrUrl: 'https://qr.sepay.vn/img?...',
      });

      const result = await service.createCheckout({ orderId: 'ord-123', amount: 70000 });
      expect(result.status).toEqual('PENDING');
      expect(result.amount).toEqual(70000);
    });

    it('UT-PAY-02: returns existing payment when same idempotency key is submitted (FR-21)', async () => {
      mockPrisma.order.findUnique.mockResolvedValue({ id: 'ord-123', totalAmount: 70000 });
      mockPrisma.payment.findUnique.mockResolvedValue({
        id: 'pay-1',
        orderId: 'ord-123',
        idempotencyKey: 'idem-key-999',
        status: 'PENDING',
      });

      const result = await service.createCheckout({
        orderId: 'ord-123',
        amount: 70000,
        idempotencyKey: 'idem-key-999',
      });

      expect(result.id).toEqual('pay-1');
      expect(mockPrisma.payment.upsert).not.toHaveBeenCalled();
    });
  });

  describe('handleWebhookIpn', () => {
    it('UT-PAY-03: atomically marks payment SUCCESS and order PAID upon valid IPN (FR-20)', async () => {
      mockPrisma.payment.findUnique.mockResolvedValue({ id: 'pay-1', orderId: 'ord-123' });
      mockPrisma.$transaction.mockImplementation(async (callback) => {
        return callback({
          payment: {
            update: jest.fn().mockResolvedValue({ id: 'pay-1', status: 'SUCCESS' }),
          },
          order: {
            update: jest.fn().mockResolvedValue({ id: 'ord-123', status: 'PAID' }),
          },
        });
      });

      const result = await service.handleWebhookIpn({
        orderId: 'ord-123',
        transactionRef: 'SEPAY_123',
        amount: 70000,
        status: 'SUCCESS',
      });

      expect(result.status).toEqual('SUCCESS');
    });
  });
});
