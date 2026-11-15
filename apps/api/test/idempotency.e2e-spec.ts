import request = require('supertest');
import { AuthService } from '../src/auth/auth.service';
import * as sepay from '../src/payments/sepay.client';
import { createTestApplication, TestApplication } from './helpers/test-app';

describe('Idempotency-Key (HTTP + PostgreSQL integration)', () => {
  let context: TestApplication;
  let customerToken: string;
  beforeAll(async () => {
    process.env.SEPAY_IPN_SECRET_KEY ||= 'brewlite-e2e-local-secret';
    context = await createTestApplication();
    await context.app.listen(0, '127.0.0.1');
    const customer = await context.prisma.user.create({
      data: { email: 'idempotency@example.test', fullName: 'Retry Test', password: 'unused-in-test' },
    });
    customerToken = context.app.get(AuthService).generateToken({
      userId: customer.id, email: customer.email, fullName: customer.fullName, role: customer.role,
    });
  });
  beforeEach(async () => {
    await context.prisma.idempotencyRecord.deleteMany();
    await context.prisma.order.deleteMany();
    await context.prisma.product.deleteMany();
  });
  afterAll(async () => { await context?.close(); });

  const product = (stock = 1) => context.prisma.product.create({
    data: { name: 'Idempotency Coffee', description: 'Test', price: 35000, imageUrl: '', stock },
  });
  const payload = (productId: string) => ({
    customerName: 'Retry Test', customerPhone: '0900000000', items: [{ productId, quantity: 1 }],
  });
  const place = (body: object, key: string) => request(context.app.getHttpServer())
    .post('/orders').auth(customerToken, { type: 'bearer' }).set('Idempotency-Key', key).send(body);
  const checkout = (orderId: string, key: string, amount = 35000) => request(context.app.getHttpServer())
    .post('/payments/sepay/checkout').set('Idempotency-Key', key).send({ orderId, amount });
  const ipn = (orderId: string, transactionRef: string) => request(context.app.getHttpServer())
    .post('/payments/sepay/webhook-ipn')
    .set('x-secret-key', process.env.SEPAY_IPN_SECRET_KEY!)
    .send({
      timestamp: Date.now(), notification_type: 'ORDER_PAID',
      order: { order_invoice_number: orderId, order_status: 'CAPTURED', order_amount: '35000', order_currency: 'VND' },
      transaction: { transaction_id: transactionRef, transaction_type: 'PAYMENT', transaction_status: 'APPROVED',
        transaction_amount: '35000', transaction_currency: 'VND' },
    });
  const expectSingleOrderAndStock = async (productId: string) => {
    expect(await context.prisma.order.count()).toBe(1);
    expect(await context.prisma.orderItem.count()).toBe(1);
    expect(await context.prisma.product.findUniqueOrThrow({ where: { id: productId } }))
      .toMatchObject({ stock: 0, version: 1 });
  };

  it('INT-IDEM-01: two sequential requests with the same header create exactly one order', async () => {
    const p = await product();
    const first = await place(payload(p.id), 'same-order').expect(201);
    const second = await place(payload(p.id), 'same-order').expect(201);
    expect(second.body).toEqual(first.body);
    await expectSingleOrderAndStock(p.id);
    expect(await context.prisma.idempotencyRecord.count()).toBe(1);
  });

  it('INT-IDEM-02: two concurrent requests with one key create one order even with only one item in stock', async () => {
    const p = await product();
    const responses = await Promise.all([
      place(payload(p.id), 'concurrent-order'), place(payload(p.id), 'concurrent-order'),
    ]);
    expect(responses.map((response) => response.status)).toEqual([201, 201]);
    expect(responses[1].body).toEqual(responses[0].body);
    await expectSingleOrderAndStock(p.id);
  });

  it('INT-IDEM-03: reordering JSON object properties still replays the original order', async () => {
    const p = await product();
    const body = payload(p.id);
    const first = await place(body, 'json-order').expect(201);
    const second = await place({ items: [{ quantity: 1, productId: p.id }], customerPhone: body.customerPhone,
      customerName: body.customerName }, 'json-order').expect(201);
    expect(second.body).toEqual(first.body);
    await expectSingleOrderAndStock(p.id);
  });

  it('INT-IDEM-04: the same key with a changed payload returns 409 without reserving more stock', async () => {
    const p = await product();
    await place(payload(p.id), 'changed-order').expect(201);
    await place({ ...payload(p.id), notes: 'A different request' }, 'changed-order').expect(409);
    await expectSingleOrderAndStock(p.id);
  });

  it('INT-IDEM-05: different keys allow two intentional identical orders', async () => {
    const p = await product(2);
    const first = await place(payload(p.id), 'first-order').expect(201);
    const second = await place(payload(p.id), 'second-order').expect(201);
    expect(second.body.id).not.toBe(first.body.id);
    expect(await context.prisma.order.count()).toBe(2);
    expect((await context.prisma.product.findUniqueOrThrow({ where: { id: p.id } })).stock).toBe(0);
  });

  it('INT-IDEM-AUTH: one account cannot replay another account\'s order with the same key', async () => {
    const p = await product();
    await place(payload(p.id), 'private-order').expect(201);
    const other = await context.prisma.user.create({
      data: { email: 'other-idempotency@example.test', fullName: 'Other Customer', password: 'unused-in-test' },
    });
    const token = context.app.get(AuthService).generateToken({
      userId: other.id, email: other.email, fullName: other.fullName, role: other.role,
    });
    const response = await request(context.app.getHttpServer()).post('/orders')
      .auth(token, { type: 'bearer' }).set('Idempotency-Key', 'private-order').send(payload(p.id)).expect(409);
    expect(response.body).not.toHaveProperty('items');
    await expectSingleOrderAndStock(p.id);
  });

  it('INT-IDEM-06: a failed transaction rolls back stock and key, allowing a corrected retry', async () => {
    const p = await product();
    await place({ ...payload(p.id), items: [{ productId: p.id, quantity: 1, size: 'INVALID' }] }, 'failed-order').expect(400);
    expect(await context.prisma.order.count()).toBe(0);
    expect(await context.prisma.idempotencyRecord.count()).toBe(0);
    expect(await context.prisma.product.findUniqueOrThrow({ where: { id: p.id } })).toMatchObject({ stock: 1, version: 0 });
    await place(payload(p.id), 'failed-order').expect(201);
    await expectSingleOrderAndStock(p.id);
  });

  it('INT-PAY-03: repeated checkout and successful IPN create one order/payment and consume stock once', async () => {
    const p = await product();
    const firstOrder = await place(payload(p.id), 'full-flow').expect(201);
    const replayOrder = await place(payload(p.id), 'full-flow').expect(201);
    expect(replayOrder.body.id).toBe(firstOrder.body.id);
    // The same key can be used on a different endpoint.
    const first = await checkout(firstOrder.body.id, 'full-flow').expect(201);
    const replay = await checkout(firstOrder.body.id, 'full-flow').expect(201);
    expect(replay.body).toEqual(first.body);
    expect(first.body.idempotencyKey).toBe('full-flow');
    await ipn(firstOrder.body.id, first.body.transactionRef).expect(201);
    const paid = await context.prisma.payment.findUniqueOrThrow({ where: { orderId: firstOrder.body.id } });
    const responses = await Promise.all([
      ipn(firstOrder.body.id, first.body.transactionRef), ipn(firstOrder.body.id, first.body.transactionRef),
    ]);
    expect(responses.map((response) => response.status)).toEqual([201, 201]);
    expect(await context.prisma.payment.count()).toBe(1);
    expect(await context.prisma.payment.findUniqueOrThrow({ where: { id: paid.id } })).toEqual(paid);
    expect(await context.prisma.order.findUniqueOrThrow({ where: { id: firstOrder.body.id } }))
      .toMatchObject({ status: 'PAID', reservationStatus: 'CONSUMED' });
    await expectSingleOrderAndStock(p.id);
    const afterPayment = await checkout(firstOrder.body.id, 'full-flow').expect(201);
    expect(afterPayment.body.status).toBe('SUCCESS');
    expect(afterPayment.body.transactionRef).toBe(paid.transactionRef);
  });

  it('INT-IDEM-07: concurrent checkout with the same header returns the same transaction and QR', async () => {
    const p = await product();
    const order = await place(payload(p.id), 'concurrent-checkout-order').expect(201);
    const responses = await Promise.all([
      checkout(order.body.id, 'concurrent-checkout'), checkout(order.body.id, 'concurrent-checkout'),
    ]);
    expect(responses.map((response) => response.status)).toEqual([201, 201]);
    expect(responses[1].body).toEqual(responses[0].body);
    expect(await context.prisma.payment.count()).toBe(1);
    await expectSingleOrderAndStock(p.id);
  });

  it('INT-IDEM-08: a payment key cannot be reused for another order or a different amount', async () => {
    const p = await product(2);
    const first = await place(payload(p.id), 'order-a').expect(201);
    const second = await place(payload(p.id), 'order-b').expect(201);
    const payment = await checkout(first.body.id, 'occupied-key').expect(201);
    await checkout(second.body.id, 'occupied-key').expect(409);
    await checkout(first.body.id, 'occupied-key', 1).expect(409);
    const replay = await checkout(first.body.id, 'occupied-key').expect(201);
    expect(replay.body).toEqual(payment.body);
    expect(await context.prisma.payment.count()).toBe(1);
  });

  it('INT-IDEM-09: old keys remain no-ops after a failed payment is retried with a new key', async () => {
    const p = await product();
    const order = await place(payload(p.id), 'retry-order').expect(201);
    const failed = await checkout(order.body.id, 'old-key').expect(201);
    // The gateway endpoint only accepts successful captures. Model a failed
    // attempt in the database, as the state-machine integration suite does.
    await context.prisma.order.update({ where: { id: order.body.id }, data: { status: 'PAYMENT_FAILED' } });
    await context.prisma.payment.update({
      where: { id: failed.body.id }, data: { status: 'FAILED', transactionRef: failed.body.transactionRef },
    });
    await checkout(order.body.id, 'new-key').expect(201);
    const before = await context.prisma.payment.findUniqueOrThrow({ where: { orderId: order.body.id } });
    const replay = await checkout(order.body.id, 'old-key').expect(201);
    expect(replay.body.transactionRef).toBe(before.transactionRef);
    expect(await context.prisma.payment.findUniqueOrThrow({ where: { id: before.id } })).toEqual(before);
    expect(await context.prisma.payment.count()).toBe(1);
  });

  it.each(['', 'a'.repeat(256)])('INT-IDEM-10: rejects an invalid key (%#) before creating an order', async (key) => {
    const p = await product();
    await place(payload(p.id), key).expect(400);
    expect(await context.prisma.order.count()).toBe(0);
    expect((await context.prisma.product.findUniqueOrThrow({ where: { id: p.id } })).stock).toBe(1);
  });

  it.each(['body', 'legacy-header'])('INT-IDEM-11: preserves payment key compatibility via %s', async (source) => {
    const p = await product();
    const order = await place(payload(p.id), 'legacy-order').expect(201);
    const send = () => {
      const req = request(context.app.getHttpServer()).post('/payments/sepay/checkout');
      return source === 'body'
        ? req.send({ orderId: order.body.id, amount: 35000, idempotencyKey: 'compatible-key' })
        : req.set('X-Idempotency-Key', 'compatible-key').send({ orderId: order.body.id, amount: 35000 });
    };
    const first = await send().expect(201);
    expect((await send().expect(201)).body).toEqual(first.body);
    expect(await context.prisma.payment.count()).toBe(1);
  });

  it('INT-IDEM-12: conflicting header and body keys return 400 without creating a payment', async () => {
    const p = await product();
    const order = await place(payload(p.id), 'conflicting-order').expect(201);
    await request(context.app.getHttpServer()).post('/payments/sepay/checkout')
      .set('Idempotency-Key', 'header-key')
      .send({ orderId: order.body.id, amount: 35000, idempotencyKey: 'body-key' }).expect(400);
    expect(await context.prisma.payment.count()).toBe(0);
  });

  it('INT-IDEM-FORM: concurrent and sequential form retries do not rewrite payment or regenerate checkout fields', async () => {
    const originalFrontendUrl = process.env.FRONTEND_URL;
    process.env.FRONTEND_URL = 'http://localhost:3000';
    const fields = jest.fn().mockReturnValue({ order_invoice_number: 'stable-invoice', signature: 'test-signature' });
    const client = jest.spyOn(sepay, 'createSePayClient').mockReturnValue({
      checkout: { initOneTimePaymentFields: fields, initCheckoutUrl: () => 'https://sandbox.pay.sepay.vn/v1/checkout/init' },
    } as unknown as ReturnType<typeof sepay.createSePayClient>);
    try {
      const p = await product();
      const order = await place(payload(p.id), 'form-order').expect(201);
      const send = () => request(context.app.getHttpServer()).post('/payments/sepay/checkout-form')
        .set('Idempotency-Key', 'same-form').send({ orderId: order.body.id });
      const responses = await Promise.all([send(), send()]);
      expect(responses.map((response) => response.status)).toEqual([201, 201]);
      expect(responses[1].body).toEqual(responses[0].body);
      const payment = await context.prisma.payment.findUniqueOrThrow({ where: { orderId: order.body.id } });
      const replay = await send().expect(201);
      expect(replay.body).toEqual(responses[0].body);
      expect(fields).toHaveBeenCalledTimes(1);
      expect(await context.prisma.payment.count()).toBe(1);
      expect(await context.prisma.payment.findUniqueOrThrow({ where: { id: payment.id } })).toEqual(payment);
      await expectSingleOrderAndStock(p.id);
    } finally {
      client.mockRestore();
      if (originalFrontendUrl === undefined) delete process.env.FRONTEND_URL;
      else process.env.FRONTEND_URL = originalFrontendUrl;
    }
  });
});
