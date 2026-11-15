import request = require('supertest');
import { Role } from '@prisma/client';
import { AuthService } from '../src/auth/auth.service';
import { InventoryService } from '../src/inventory/inventory.service';
import { finalizeRefundCancellation } from '../src/orders/order-transition';
import { createTestApplication, TestApplication } from './helpers/test-app';

describe('Loyalty redemption at checkout (HTTP + PostgreSQL)', () => {
  let context: TestApplication;
  let userId: string;
  let token: string;
  let staffToken: string;
  beforeAll(async () => {
    process.env.SEPAY_IPN_SECRET_KEY ||= 'redemption-test-secret';
    context = await createTestApplication();
    await context.app.listen(0, '127.0.0.1');
    const user = await context.prisma.user.create({ data: {
      email: 'redeem@example.test', fullName: 'Redeem Customer', password: 'unused', loyaltyPoints: 46,
    } });
    userId = user.id;
    const auth = context.app.get(AuthService);
    token = auth.generateToken({ userId, email: user.email, fullName: user.fullName, role: user.role });
    staffToken = auth.generateToken({ userId: 'redemption-staff', email: 'staff@example.test', fullName: 'Staff', role: Role.BARISTA });
  });
  beforeEach(async () => {
    await context.prisma.loyaltyTransaction.deleteMany();
    await context.prisma.idempotencyRecord.deleteMany();
    await context.prisma.order.deleteMany();
    await context.prisma.product.deleteMany();
    await context.prisma.promotion.deleteMany();
    await context.prisma.user.update({ where: { id: userId }, data: { loyaltyPoints: 46 } });
  });
  afterAll(async () => { await context?.close(); });
  const product = (price = 46800) => context.prisma.product.create({ data: {
    name: 'Redemption Coffee', price, description: 'Test', imageUrl: '', stock: 3,
  } });
  const place = (productId: string, points: unknown = 46, key = 'redeem-order', extra: object = {}) => request(context.app.getHttpServer())
    .post('/orders').auth(token, { type: 'bearer' }).set('Idempotency-Key', key)
    .send({ customerName: 'Redeem Customer', customerPhone: '0900000000', items: [{ productId, quantity: 1 }], redeemedPoints: points, ...extra });
  const balance = async () => (await context.prisma.user.findUniqueOrThrow({ where: { id: userId } })).loyaltyPoints;
  const cancel = (id: string) => request(context.app.getHttpServer()).patch(`/orders/${id}/status`)
    .auth(staffToken, { type: 'bearer' }).send({ status: 'CANCELLED' });
  const pay = (id: string, amount = 42200) => request(context.app.getHttpServer()).post('/payments/sepay/webhook-ipn')
    .set('x-secret-key', process.env.SEPAY_IPN_SECRET_KEY!).send({
      timestamp: Date.now(), notification_type: 'ORDER_PAID',
      order: { order_invoice_number: id, order_status: 'CAPTURED', order_amount: String(amount), order_currency: 'VND' },
      transaction: { transaction_id: `paid-${id}`, transaction_type: 'PAYMENT', transaction_status: 'APPROVED', transaction_amount: String(amount), transaction_currency: 'VND' },
    });

  it('debits 46 points once and calculates the 4,600 VND discount on the server', async () => {
    const p = await product();
    const first = await place(p.id, 46, 'same-request', { totalAmount: 1, loyaltyDiscountAmount: 999999 }).expect(201);
    expect(first.body).toMatchObject({ redeemedPoints: 46, loyaltyDiscountAmount: 4600, totalAmount: 42200, status: 'PENDING' });
    const retry = await place(p.id, 46, 'same-request', { totalAmount: 1, loyaltyDiscountAmount: 999999 }).expect(201);
    expect(retry.body).toEqual(first.body);
    expect(await balance()).toBe(0);
    expect(await context.prisma.order.count()).toBe(1);
    expect(await context.prisma.loyaltyTransaction.findMany()).toEqual([expect.objectContaining({ type: 'REDEEM', points: 46, orderId: first.body.id })]);
    expect(await context.prisma.product.findUniqueOrThrow({ where: { id: p.id } })).toMatchObject({ stock: 2 });
  });

  it('applies points after the promotion discount', async () => {
    const p = await product(50000);
    await context.prisma.promotion.create({ data: { code: 'REDEEM10', discountType: 'PERCENTAGE', discountValue: 10, isActive: true } });
    const result = await place(p.id, 10, 'with-promo', { promotionCode: 'REDEEM10' }).expect(201);
    expect(result.body).toMatchObject({ subtotalAmount: 50000, discountAmount: 5000, loyaltyDiscountAmount: 1000, totalAmount: 44000 });
    expect(await balance()).toBe(36);
  });

  it.each([-1, 1.5, '1', 47, Number.MAX_SAFE_INTEGER])('rejects invalid or unavailable points %s and rolls back stock and order writes', async (points) => {
    const p = await product();
    await place(p.id, points).expect(400);
    expect(await balance()).toBe(46);
    expect(await context.prisma.order.count()).toBe(0);
    expect(await context.prisma.loyaltyTransaction.count()).toBe(0);
    expect(await context.prisma.product.findUniqueOrThrow({ where: { id: p.id } })).toMatchObject({ stock: 3 });
  });

  it('rejects points exceeding the net bill even if the customer has enough balance', async () => {
    const p = await product(1000);
    await place(p.id, 11).expect(400);
    expect(await balance()).toBe(46);
  });

  it('prevents concurrent orders from overspending the same balance', async () => {
    const p = await product();
    const results = await Promise.all([place(p.id, 30, 'first'), place(p.id, 30, 'second')]);
    expect(results.map((response) => response.status).sort()).toEqual([201, 400]);
    expect(await balance()).toBe(16);
    expect(await context.prisma.order.count()).toBe(1);
    expect(await context.prisma.loyaltyTransaction.count()).toBe(1);
  });

  it('returns redeemed points once when an unpaid order is cancelled', async () => {
    const p = await product();
    const order = await place(p.id).expect(201);
    await cancel(order.body.id).expect(200);
    await cancel(order.body.id).expect(409);
    expect(await balance()).toBe(46);
    expect(await context.prisma.loyaltyTransaction.count({ where: { orderId: order.body.id, type: 'REFUND' } })).toBe(1);
  });

  it('returns points and stock once when concurrent sweepers expire an unpaid order', async () => {
    const p = await product();
    const order = await place(p.id).expect(201);
    await context.prisma.order.update({ where: { id: order.body.id }, data: { reservationExpiresAt: new Date(Date.now() - 1000) } });
    const inventory = context.app.get(InventoryService);
    await Promise.all([inventory.expireReservations(order.body.id), inventory.expireReservations(order.body.id)]);
    expect(await balance()).toBe(46);
    expect(await context.prisma.loyaltyTransaction.count({ where: { type: 'REFUND' } })).toBe(1);
    expect(await context.prisma.product.findUniqueOrThrow({ where: { id: p.id } })).toMatchObject({ stock: 3 });
  });

  it('charges only the net bill and earns points only on money actually paid', async () => {
    const p = await product();
    const order = await place(p.id).expect(201);
    await request(context.app.getHttpServer()).post('/payments/sepay/checkout').send({ orderId: order.body.id, amount: 42200 }).expect(201);
    await pay(order.body.id, 46800).expect(409);
    await pay(order.body.id).expect(200);
    await pay(order.body.id).expect(200);
    expect(await balance()).toBe(42);
    expect(await context.prisma.loyaltyTransaction.count({ where: { type: 'REDEEM' } })).toBe(1);
    expect(await context.prisma.loyaltyTransaction.count({ where: { type: 'EARN' } })).toBe(1);
  });

  it('settles a fully discounted order without sending a zero-amount payment to SePay', async () => {
    const p = await product(4600);
    const order = await place(p.id).expect(201);
    expect(order.body).toMatchObject({ status: 'PAID', totalAmount: 0, redeemedPoints: 46, loyaltyDiscountAmount: 4600, reservationStatus: 'CONSUMED' });
    expect(await balance()).toBe(0);
    expect(await context.prisma.payment.findUniqueOrThrow({ where: { orderId: order.body.id } })).toMatchObject({ method: 'LOYALTY', amount: 0, status: 'SUCCESS' });
    expect(await context.prisma.loyaltyTransaction.count({ where: { type: 'EARN' } })).toBe(0);
  });

  it('restores redeemed points after a paid order has a verified full refund', async () => {
    const p = await product();
    const order = await place(p.id).expect(201);
    await request(context.app.getHttpServer()).post('/payments/sepay/checkout').send({ orderId: order.body.id, amount: 42200 }).expect(201);
    await pay(order.body.id).expect(200);
    const payment = await context.prisma.payment.findUniqueOrThrow({ where: { orderId: order.body.id } });
    await context.prisma.refund.create({ data: { orderId: order.body.id, paymentId: payment.id,
      amount: 42200, status: 'SUCCEEDED', sepayRefundId: 'verified-refund', idempotencyKey: 'refund-once', originalTxnRef: payment.transactionRef! } });
    await context.prisma.$transaction((tx) => finalizeRefundCancellation(tx, order.body.id));
    expect(await balance()).toBe(88);
    expect(await context.prisma.loyaltyTransaction.count({ where: { type: 'REFUND' } })).toBe(1);
  });
});
