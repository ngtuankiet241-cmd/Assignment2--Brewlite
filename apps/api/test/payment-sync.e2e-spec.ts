import request = require('supertest');
import { ServiceUnavailableException } from '@nestjs/common';
import { AuthService } from '../src/auth/auth.service';
import * as sepay from '../src/payments/sepay.client';
import { createTestApplication, TestApplication } from './helpers/test-app';

describe('SePay payment reconciliation (HTTP + PostgreSQL)', () => {
  let context: TestApplication;
  let userId: string;
  let token: string;
  let otherToken: string;
  let retrieve: jest.SpyInstance;

  beforeAll(async () => {
    process.env.SEPAY_IPN_SECRET_KEY ||= 'payment-sync-test-secret';
    context = await createTestApplication();
    await context.app.listen(0, '127.0.0.1');
    const user = await context.prisma.user.create({ data: {
      email: 'payment-sync@example.test', fullName: 'Payment Sync', password: 'unused',
    } });
    userId = user.id;
    const auth = context.app.get(AuthService);
    token = auth.generateToken({ userId, email: user.email, fullName: user.fullName, role: user.role });
    otherToken = auth.generateToken({ userId: 'other-customer', email: 'other@example.test', fullName: 'Other', role: user.role });
    retrieve = jest.spyOn(sepay, 'retrieveSePayOrder');
  });
  beforeEach(async () => {
    retrieve.mockReset();
    await context.prisma.loyaltyTransaction.deleteMany();
    await context.prisma.order.deleteMany();
    await context.prisma.product.deleteMany();
    await context.prisma.user.update({ where: { id: userId }, data: { loyaltyPoints: 0 } });
  });
  afterAll(async () => { retrieve?.mockRestore(); await context?.close(); });

  async function place() {
    const product = await context.prisma.product.create({ data: {
      name: 'Sync Coffee', description: 'Test', imageUrl: '', price: 46800, stock: 3,
    } });
    const response = await request(context.app.getHttpServer()).post('/orders').auth(token, { type: 'bearer' })
      .send({ customerName: 'Payment Sync', customerPhone: '0900000000', items: [{ productId: product.id, quantity: 1 }] }).expect(201);
    await context.prisma.payment.create({ data: { orderId: response.body.id, amount: 46800, method: 'SEPAY_QR', status: 'PENDING' } });
    return { id: response.body.id as string, productId: product.id };
  }
  const sync = (orderId: string, credential = token) => request(context.app.getHttpServer())
    .post('/payments/sepay/sync').auth(credential, { type: 'bearer' }).send({ orderId, status: 'SUCCESS', amount: 1 });
  const proof = (orderId: string) => ({ data: {
    order_invoice_number: orderId, order_status: 'CAPTURED', order_amount: '46800.00', order_currency: 'VND',
    transactions: [{ id: 'gateway-transaction-uuid', transaction_type: 'PAYMENT', transaction_status: 'APPROVED',
      transaction_amount: '46800', transaction_currency: 'VND' }],
  } });
  async function expectPending(orderId: string) {
    expect(await context.prisma.order.findUniqueOrThrow({ where: { id: orderId } })).toMatchObject({ status: 'PENDING' });
    expect(await context.prisma.payment.findUniqueOrThrow({ where: { orderId } })).toMatchObject({ status: 'PENDING', paidAt: null });
    expect(await context.prisma.loyaltyTransaction.count()).toBe(0);
  }

  it('requires authentication and ownership before contacting SePay', async () => {
    const order = await place();
    await request(context.app.getHttpServer()).post('/payments/sepay/sync').send({ orderId: order.id }).expect(401);
    await sync(order.id, otherToken).expect(404);
    expect(retrieve).not.toHaveBeenCalled();
    await expectPending(order.id);
  });

  it('accepts the configured legacy IPN URL with the same authentication and replay protection', async () => {
    const order = await place();
    const payload = {
      notification_type: 'ORDER_PAID', timestamp: Date.now(),
      order: { order_invoice_number: order.id, order_status: 'CAPTURED', order_amount: '46800.00', order_currency: 'VND' },
      transaction: { id: 'legacy-transaction-uuid', transaction_id: 'legacy-short-reference', transaction_type: 'PAYMENT',
        transaction_status: 'APPROVED', transaction_amount: '46800', transaction_currency: 'VND' },
    };
    await request(context.app.getHttpServer()).post('/payments/ipn').send(payload).expect(401);
    await expectPending(order.id);
    await request(context.app.getHttpServer()).post('/payments/ipn')
      .set('x-secret-key', process.env.SEPAY_IPN_SECRET_KEY!).send(payload).expect(200);
    await request(context.app.getHttpServer()).post('/payments/sepay/webhook-ipn')
      .set('x-secret-key', process.env.SEPAY_IPN_SECRET_KEY!).send(payload).expect(200);
    expect(await context.prisma.loyaltyTransaction.count({ where: { orderId: order.id } })).toBe(1);
    expect(await context.prisma.user.findUniqueOrThrow({ where: { id: userId } })).toMatchObject({ loyaltyPoints: 46 });
  });

  it('recovers a missed IPN, awards points once, and accepts a later genuine IPN replay', async () => {
    const order = await place();
    retrieve.mockResolvedValue(proof(order.id));
    const responses = await Promise.all([sync(order.id), sync(order.id)]);
    expect(responses.map((response) => response.status)).toEqual([200, 200]);
    expect(responses[0].body).toEqual({ orderId: order.id, status: 'PAID', paymentStatus: 'SUCCESS' });
    await request(context.app.getHttpServer()).post('/payments/sepay/webhook-ipn')
      .set('x-secret-key', process.env.SEPAY_IPN_SECRET_KEY!).send({
        notification_type: 'ORDER_PAID', timestamp: Date.now(),
        order: { order_invoice_number: order.id, order_status: 'CAPTURED', order_amount: '46800.00', order_currency: 'VND' },
        transaction: { id: 'gateway-transaction-uuid', transaction_id: 'gateway-short-reference', transaction_type: 'PAYMENT',
          transaction_status: 'APPROVED', transaction_amount: '46800', transaction_currency: 'VND' },
      }).expect(200);
    const calls = retrieve.mock.calls.length;
    await sync(order.id).expect(200);
    expect(retrieve).toHaveBeenCalledTimes(calls);
    expect(await context.prisma.user.findUniqueOrThrow({ where: { id: userId } })).toMatchObject({ loyaltyPoints: 46 });
    expect(await context.prisma.loyaltyTransaction.count({ where: { orderId: order.id } })).toBe(1);
    expect(await context.prisma.product.findUniqueOrThrow({ where: { id: order.productId } })).toMatchObject({ stock: 2 });
    expect(await context.prisma.order.findUniqueOrThrow({ where: { id: order.id } })).toMatchObject({ reservationStatus: 'CONSUMED' });
  });

  it.each(['unpaid', 'not-found'])('does not trust browser success when SePay is %s', async (state) => {
    const order = await place();
    const remote = proof(order.id);
    remote.data.order_status = 'AUTHENTICATION_NOT_NEEDED';
    retrieve.mockResolvedValue(state === 'not-found' ? null : remote);
    expect((await sync(order.id).expect(200)).body.status).toBe('PENDING');
    await expectPending(order.id);
  });

  it.each(['invoice', 'amount', 'currency', 'transaction-amount', 'transaction-status', 'no-transaction'])('rejects inconsistent remote proof: %s', async (field) => {
    const order = await place();
    const remote = proof(order.id);
    if (field === 'invoice') remote.data.order_invoice_number = 'another-order';
    if (field === 'amount') remote.data.order_amount = '46801';
    if (field === 'currency') remote.data.order_currency = 'USD';
    if (field === 'transaction-amount') remote.data.transactions[0].transaction_amount = '1';
    if (field === 'transaction-status') remote.data.transactions[0].transaction_status = 'DECLINED';
    if (field === 'no-transaction') remote.data.transactions = [];
    retrieve.mockResolvedValue(remote);
    await sync(order.id).expect(409);
    await expectPending(order.id);
  });

  it('preserves pending payment when SePay is unavailable', async () => {
    const order = await place();
    retrieve.mockRejectedValue(new ServiceUnavailableException('SePay unavailable'));
    await sync(order.id).expect(503);
    await expectPending(order.id);
  });

  it('never reopens a cancelled order or credits points after reservation expiry', async () => {
    const order = await place();
    retrieve.mockResolvedValue(proof(order.id));
    await context.prisma.order.update({ where: { id: order.id }, data: { reservationExpiresAt: new Date(Date.now() - 1000) } });
    await sync(order.id).expect(409);
    expect(await context.prisma.order.findUniqueOrThrow({ where: { id: order.id } })).toMatchObject({ status: 'CANCELLED', reservationStatus: 'RELEASED' });
    expect(await context.prisma.loyaltyTransaction.count()).toBe(0);
    expect(await context.prisma.product.findUniqueOrThrow({ where: { id: order.productId } })).toMatchObject({ stock: 3 });
    retrieve.mockClear();
    expect((await sync(order.id).expect(200)).body.status).toBe('CANCELLED');
    expect(retrieve).not.toHaveBeenCalled();
  });
});
