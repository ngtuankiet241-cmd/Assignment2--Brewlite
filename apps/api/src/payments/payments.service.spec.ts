import { Test, TestingModule } from '@nestjs/testing';
import { PaymentsService } from './payments.service';
import { PrismaService } from '../prisma/prisma.service';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { InventoryService } from '../inventory/inventory.service';

describe('PaymentsService', () => {
  let service: PaymentsService;
  let prisma: PrismaService;

  const mockPrisma = {
    $queryRaw: jest.fn(),
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
    jest.clearAllMocks();
    mockPrisma.$transaction.mockImplementation((work) => work(mockPrisma));
    mockPrisma.$queryRaw.mockResolvedValue([{ id: 'ord-123', status: 'PENDING', totalAmount: 70000 }]);
    mockPrisma.order.update.mockImplementation(({ where, data }) => Promise.resolve({ id: where.id, ...data }));
    mockPrisma.payment.findUnique.mockResolvedValue({
      id: 'pay-1', orderId: 'ord-123', status: 'PENDING', amount: 70000, transactionRef: 'checkout-ref',
    });
    mockPrisma.payment.update.mockImplementation(({ data }) => Promise.resolve({ id: 'pay-1', orderId: 'ord-123', ...data }));
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: InventoryService, useValue: { expireReservations: jest.fn().mockResolvedValue(0) } },
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
      const result = await service.handleWebhookIpn({
        orderId: 'ord-123',
        transactionRef: 'SEPAY_123',
        amount: 70000,
        status: 'SUCCESS',
      });

      expect(result.status).toEqual('SUCCESS');
      expect(mockPrisma.order.update).toHaveBeenCalledWith({ where: { id: 'ord-123' }, data: { status: 'PAID' } });
    });

    it('UT-PAY-04: payment failure moves the order to PAYMENT_FAILED', async () => {
      const result = await service.handleWebhookIpn({ orderId: 'ord-123', transactionRef: 'failed-ref', amount: 70000, status: 'FAILED' });
      expect(result.status).toBe('FAILED');
      expect(mockPrisma.order.update).toHaveBeenCalledWith({ where: { id: 'ord-123' }, data: { status: 'PAYMENT_FAILED' } });
    });

    it.each(['CANCELLED', 'COMPLETED', 'PREPARING'])('UT-PAY-05: IPN cannot change an order in %s', async (status) => {
      mockPrisma.$queryRaw.mockResolvedValue([{ id: 'ord-123', status }]);
      await expect(service.handleWebhookIpn({ orderId: 'ord-123', transactionRef: 'new-ref', amount: 70000, status: 'SUCCESS' })).rejects.toThrow(ConflictException);
      expect(mockPrisma.order.update).not.toHaveBeenCalled();
      expect(mockPrisma.payment.update).not.toHaveBeenCalled();
    });

    it('UT-PAY-06: an exact success replay does not rewind a completed order', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([{ id: 'ord-123', status: 'COMPLETED' }]);
      mockPrisma.payment.findUnique.mockResolvedValue({ id: 'pay-1', orderId: 'ord-123', amount: 70000, transactionRef: 'paid-ref', status: 'SUCCESS' });
      await service.handleWebhookIpn({ orderId: 'ord-123', transactionRef: 'paid-ref', amount: 70000, status: 'SUCCESS' });
      expect(mockPrisma.order.update).not.toHaveBeenCalled();
      expect(mockPrisma.payment.update).not.toHaveBeenCalled();
    });

    it('UT-PAY-07: a failed callback cannot downgrade a successful payment', async () => {
      mockPrisma.payment.findUnique.mockResolvedValue({ id: 'pay-1', orderId: 'ord-123', status: 'SUCCESS' });
      await expect(service.handleWebhookIpn({ orderId: 'ord-123', transactionRef: 'failed-ref', amount: 70000, status: 'FAILED' })).rejects.toThrow(ConflictException);
      expect(mockPrisma.order.update).not.toHaveBeenCalled();
      expect(mockPrisma.payment.update).not.toHaveBeenCalled();
    });

    it('UT-PAY-08: rejects an invalid callback status before starting a transaction', async () => {
      await expect(service.handleWebhookIpn({ orderId: 'ord-123', transactionRef: 'ref', amount: 70000, status: 'UNKNOWN' as any })).rejects.toThrow(BadRequestException);
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });
  });

  describe('checkout state restrictions', () => {
    it.each(['PAID', 'PREPARING', 'READY', 'COMPLETED', 'CANCELLED'])('UT-PAY-09: cannot start a new payment for %s', async (status) => {
      mockPrisma.$queryRaw.mockResolvedValue([{ id: 'ord-123', status }]);
      await expect(service.createCheckout({ orderId: 'ord-123', amount: 70000 })).rejects.toThrow(ConflictException);
      expect(mockPrisma.payment.upsert).not.toHaveBeenCalled();
    });

    it('UT-PAY-10: retrying a failed payment resets the order to PENDING in the same transaction', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([{ id: 'ord-123', status: 'PAYMENT_FAILED' }]);
      await service.createCheckout({ orderId: 'ord-123', amount: 70000 });
      expect(mockPrisma.order.update).toHaveBeenCalledWith({ where: { id: 'ord-123' }, data: { status: 'PENDING' } });
      expect(mockPrisma.payment.upsert).toHaveBeenCalledWith(expect.objectContaining({ update: expect.objectContaining({ status: 'PENDING', paidAt: null }) }));
    });
  });
});

