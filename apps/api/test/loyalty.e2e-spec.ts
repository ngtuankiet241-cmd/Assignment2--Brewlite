import request = require('supertest');
import { Role } from '@prisma/client';
import { AuthService } from '../src/auth/auth.service';
import { createTestApplication, TestApplication } from './helpers/test-app';

describe('Loyalty after PAID (HTTP + PostgreSQL integration)', () => {
  let context: TestApplication;
  let customerId: string;
  let otherId: string;
  let customerToken: string;
  let otherToken: string;
  let staffToken: string;

  beforeAll(async () => {
    process.env.SEPAY_IPN_SECRET_KEY ||= 'brewlite-e2e-local-secret';
    context = await createTestApplication();
    await context.app.listen(0, '127.0.0.1');
    const auth = context.app.get(AuthService);
    const accounts = await Promise.all(['customer', 'other'].map((name) => context.prisma.user.create({
      data: { email: `${name}-loyalty@example.test`, fullName: name, password: 'unused-in-test' },
    })));
    [customerId, otherId] = accounts.map((user) => user.id);
    [customerToken, otherToken] = accounts.map((user) => auth.generateToken({
      userId: user.id, email: user.email, fullName: user.fullName, role: user.role,
    }));
    staffToken = auth.generateToken({
      userId: 'loyalty-staff', email: 'staff@example.test', fullName: 'Staff', role: Role.BARISTA,
    });
  });
  beforeEach(async () => {
    await context.prisma.loyaltyTransaction.deleteMany();
    await context.prisma.idempotencyRecord.deleteMany();
    await context.prisma.order.deleteMany();
    await context.prisma.product.deleteMany();
    await context.prisma.promotion.deleteMany();
    await context.prisma.user.updateMany({ data: { loyaltyPoints: 0 } });
  });
  afterAll(async () => { await context?.close(); });

  const product = (price = 34999) => context.prisma.product.create({
    data: { name: 'Loyalty Coffee', description: 'Test', price, imageUrl: '', stock: 10 },
  });
  const place = (productId: string, key = 'loyalty-order', extra: object = {}) => request(context.app.getHttpServer())
    .post('/orders').auth(customerToken, { type: 'bearer' }).set('Idempotency-Key', key)
    .send({ customerName: 'Loyalty Customer', customerPhone: '0900000000', items: [{ productId, quantity: 1 }], ...extra });
  const checkout = (orderId: string, amount = 34999) => request(context.app.getHttpServer())
    .post('/payments/sepay/checkout').set('Idempotency-Key', `pay-${orderId}`).send({ orderId, amount });
  const ipn = (orderId: string, transactionRef = `paid-${orderId}`, amount = 34999) => request(context.app.getHttpServer())
    .post('/payments/sepay/webhook-ipn').set('x-secret-key', process.env.SEPAY_IPN_SECRET_KEY!)
    .send({
      timestamp: Date.now(), notification_type: 'ORDER_PAID',
      order: { order_invoice_number: orderId, order_status: 'CAPTURED', order_amount: String(amount), order_currency: 'VND' },
      transaction: { transaction_id: transactionRef, transaction_type: 'PAYMENT', transaction_status: 'APPROVED',
        transaction_amount: String(amount), transaction_currency: 'VND' },
    });
  const patch = (orderId: string, status: string) => request(context.app.getHttpServer())
    .patch(`/orders/${orderId}/status`).auth(staffToken, { type: 'bearer' }).send({ status });
  const balance = async (id = customerId) =>
    (await context.prisma.user.findUniqueOrThrow({ where: { id } })).loyaltyPoints;
  const account = (token = customerToken) => request(context.app.getHttpServer())
    .get('/loyalty/me').auth(token, { type: 'bearer' });

  it('INT-LOYAL-01: creates an EARN entry and credits floor(paid amount / 1000) only after PAID', async () => {
    const p = await product();
    const order = await place(p.id).expect(201);
    await checkout(order.body.id).expect(201);
    expect(await balance()).toBe(0);
    expect(await context.prisma.loyaltyTransaction.count()).toBe(0);
    await ipn(order.body.id).expect(201);
    expect(await balance()).toBe(34);
    expect(await context.prisma.loyaltyTransaction.findMany()).toEqual([
      expect.objectContaining({ userId: customerId, orderId: order.body.id, points: 34, type: 'EARN' }),
    ]);
    const response = await account().expect(200);
    expect(response.body).toMatchObject({ loyaltyPoints: 34, vndPerPoint: 1000, transactions: [
      { orderId: order.body.id, points: 34, type: 'EARN' },
    ] });
    expect(response.body).not.toHaveProperty('password');
    expect(response.body).not.toHaveProperty('email');
    await expect(context.prisma.loyaltyTransaction.create({
      data: { userId: customerId, orderId: order.body.id, points: 34, type: 'EARN' },
    })).rejects.toMatchObject({ code: 'P2002' });
    expect(await balance()).toBe(34);
  });

  it('INT-LOYAL-02: concurrent callbacks, checkout replay, and later status changes never credit twice', async () => {
    const p = await product();
    const order = await place(p.id).expect(201);
    const duplicateOrder = await place(p.id).expect(201);
    expect(duplicateOrder.body.id).toBe(order.body.id);
    await checkout(order.body.id).expect(201);
    const responses = await Promise.all([ipn(order.body.id), ipn(order.body.id)]);
    expect(responses.map((response) => response.status)).toEqual([201, 201]);
    const entry = await context.prisma.loyaltyTransaction.findFirstOrThrow();
    await checkout(order.body.id).expect(201);
    for (const status of ['CONFIRMED', 'PREPARING', 'READY', 'COMPLETED']) {
      await patch(order.body.id, status).expect(200);
    }
    await ipn(order.body.id).expect(201);
    expect(await balance()).toBe(34);
    expect(await context.prisma.order.count()).toBe(1);
    expect(await context.prisma.loyaltyTransaction.findMany()).toEqual([entry]);
  });

  it('INT-LOYAL-03: concurrent paid orders add to the existing balance without losing increments', async () => {
    await context.prisma.user.update({ where: { id: customerId }, data: { loyaltyPoints: 25 } });
    const p = await product();
    const first = await place(p.id, 'first').expect(201);
    const second = await place(p.id, 'second').expect(201);
    await checkout(first.body.id).expect(201);
    await checkout(second.body.id).expect(201);
    const responses = await Promise.all([ipn(first.body.id), ipn(second.body.id)]);
    expect(responses.map((response) => response.status)).toEqual([201, 201]);
    expect(await balance()).toBe(25 + 34 + 34);
    expect(await context.prisma.loyaltyTransaction.count()).toBe(2);
    expect(await balance(otherId)).toBe(0);
  });

  it('INT-LOYAL-04: credits the JWT owner using the authoritative total after discount, ignoring spoofed fields', async () => {
    const p = await product(59997);
    await context.prisma.promotion.create({ data: {
      code: 'LOYAL10', discountType: 'FIXED_AMOUNT', discountValue: 10000,
      validFrom: new Date('2020-01-01'),
    } });
    const order = await place(p.id, 'discounted', {
      promotionCode: 'LOYAL10', totalAmount: 1, loyaltyPoints: 999999, userId: otherId,
    }).expect(201);
    expect(order.body).toMatchObject({ userId: customerId, subtotalAmount: 59997, discountAmount: 10000, totalAmount: 49997 });
    await checkout(order.body.id, 49997).expect(201);
    await ipn(order.body.id, 'discounted-payment', 49997).expect(201);
    expect(await balance()).toBe(49);
    expect(await balance(otherId)).toBe(0);
  });

  it('INT-LOYAL-05: payment failure rolls back order, earned entry and balance atomically', async () => {
    const p = await product();
    const order = await place(p.id).expect(201);
    await checkout(order.body.id).expect(201);
    const other = await context.prisma.order.create({ data: {
      customerName: 'Occupied payment reference', customerPhone: '0900000000', totalAmount: 34999,
      payment: { create: { amount: 34999, transactionRef: 'occupied-reference' } },
    } });
    await ipn(order.body.id, 'occupied-reference').expect(409);
    expect(await balance()).toBe(0);
    expect(await context.prisma.loyaltyTransaction.count()).toBe(0);
    expect(await context.prisma.order.findUniqueOrThrow({ where: { id: order.body.id } }))
      .toMatchObject({ status: 'PENDING', reservationStatus: 'HELD' });
    expect(await context.prisma.payment.findUniqueOrThrow({ where: { orderId: order.body.id } }))
      .toMatchObject({ status: 'PENDING', paidAt: null });
    await ipn(order.body.id, 'valid-reference').expect(201);
    expect(await balance()).toBe(34);
    expect(await context.prisma.loyaltyTransaction.count()).toBe(1);
    expect(other.id).not.toBe(order.body.id);
  });

  it('INT-LOYAL-06: an authorized staff PAID transition uses the same earning rule', async () => {
    const p = await product();
    const order = await place(p.id).expect(201);
    await patch(order.body.id, 'PAID').expect(200);
    await patch(order.body.id, 'PAID').expect(409);
    expect(await balance()).toBe(34);
    expect(await context.prisma.loyaltyTransaction.count()).toBe(1);
  });

  it.each(['PAYMENT_FAILED', 'CANCELLED'])('INT-LOYAL-07: %s orders do not earn points', async (status) => {
    const p = await product();
    const order = await place(p.id).expect(201);
    await checkout(order.body.id).expect(201);
    await patch(order.body.id, status).expect(200);
    expect(await balance()).toBe(0);
    expect(await context.prisma.loyaltyTransaction.count()).toBe(0);
  });

  it('INT-LOYAL-08: an invalid payment amount leaves the balance and history unchanged', async () => {
    const p = await product();
    const order = await place(p.id).expect(201);
    await checkout(order.body.id).expect(201);
    await ipn(order.body.id, 'wrong-amount', 35000).expect(409);
    expect(await balance()).toBe(0);
    expect(await context.prisma.loyaltyTransaction.count()).toBe(0);
  });

  it.each([0, 999])('INT-LOYAL-09: a PAID order of %s VND earns zero points', async (amount) => {
    const p = await product(amount);
    const order = await place(p.id).expect(201);
    // Staff can settle zero-value orders; the gateway requires a positive amount.
    await patch(order.body.id, 'PAID').expect(200);
    expect(await balance()).toBe(0);
    expect(await context.prisma.loyaltyTransaction.count()).toBe(0);
  });

  it('INT-LOYAL-10: legacy orders without a customer can become PAID without assigning points to someone else', async () => {
    const order = await context.prisma.order.create({ data: {
      customerName: 'Legacy guest', customerPhone: '0900000000', totalAmount: 34999,
    } });
    await checkout(order.id).expect(201);
    await ipn(order.id).expect(201);
    expect((await context.prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe('PAID');
    expect(await context.prisma.loyaltyTransaction.count()).toBe(0);
    expect(await balance()).toBe(0);
  });

  it('INT-LOYAL-11: the account endpoint requires authentication and cannot read another user by query', async () => {
    await request(context.app.getHttpServer()).get('/loyalty/me').expect(401);
    await account('invalid-token').expect(401);
    const p = await product();
    const order = await place(p.id).expect(201);
    await patch(order.body.id, 'PAID').expect(200);
    const response = await request(context.app.getHttpServer()).get(`/loyalty/me?userId=${customerId}`)
      .auth(otherToken, { type: 'bearer' }).expect(200);
    expect(response.body).toEqual({ loyaltyPoints: 0, vndPerPoint: 1000, transactions: [] });
  });

  it('INT-LOYAL-12: returns only the most recent 20 entries for the authenticated account', async () => {
    await context.prisma.loyaltyTransaction.createMany({ data: Array.from({ length: 25 }, (_, index) => ({
      userId: customerId, points: index + 1, type: 'EARN' as const, createdAt: new Date(Date.UTC(2026, 0, 1, 0, 0, index)),
    })) });
    await context.prisma.user.update({ where: { id: customerId }, data: { loyaltyPoints: 325 } });
    const response = await account().expect(200);
    expect(response.body.loyaltyPoints).toBe(325);
    expect(response.body.transactions).toHaveLength(20);
    expect(response.body.transactions.map((entry: { points: number }) => entry.points))
      .toEqual(Array.from({ length: 20 }, (_, index) => 25 - index));
    expect((await account(otherToken).expect(200)).body.transactions).toEqual([]);
  });
});
