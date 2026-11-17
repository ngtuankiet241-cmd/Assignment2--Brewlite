import request = require('supertest');
import { Role } from '@prisma/client';
import { AuthService } from '../src/auth/auth.service';
import { createTestApplication, TestApplication } from './helpers/test-app';

// Missing Test IDs from docs/traceability-matrix.md. All HTTP/database behavior is real;
// SePay callbacks are fixtures and these tests never send a payment to an external gateway.
describe('Traceability Matrix gaps (HTTP + PostgreSQL)', () => {
  let context: TestApplication;
  let customerId: string;
  let customerToken: string;
  let otherId: string;
  let otherToken: string;
  let staffToken: string;
  let productId: string;

  beforeAll(async () => {
    process.env.SEPAY_IPN_SECRET_KEY ||= 'traceability-test-secret';
    context = await createTestApplication();
    await context.app.listen(0, '127.0.0.1');
    const auth = context.app.get(AuthService);
    const accounts = await Promise.all(['customer', 'other'].map((name) => context.prisma.user.create({
      data: { email: `${name}-traceability@example.test`, fullName: name, password: 'unused-test-password' },
    })));
    [customerId, otherId] = accounts.map((user) => user.id);
    [customerToken, otherToken] = accounts.map((user) => auth.generateToken({
      userId: user.id, email: user.email, fullName: user.fullName, role: user.role,
    }));
    staffToken = auth.generateToken({
      userId: 'traceability-staff', email: 'staff@example.test', fullName: 'Staff', role: Role.BARISTA,
    });
  });

  beforeEach(async () => {
    await context.prisma.loyaltyTransaction.deleteMany();
    await context.prisma.idempotencyRecord.deleteMany();
    await context.prisma.order.deleteMany();
    await context.prisma.product.deleteMany();
    await context.prisma.user.updateMany({ data: { loyaltyPoints: 0 } });
    await context.prisma.drinkSizeOption.updateMany({ data: { isActive: true } });
    await context.prisma.toppingOption.updateMany({ data: { isActive: true } });
    const product = await context.prisma.product.create({
      data: { name: 'Traceability Coffee', description: 'Milk coffee', price: 35000, stock: 10, imageUrl: '/coffee.svg' },
    });
    productId = product.id;
  });

  afterAll(async () => { await context?.close(); });

  const place = (extra: object = {}, token = customerToken) => request(context.app.getHttpServer())
    .post('/orders').auth(token, { type: 'bearer' }).send({
      customerName: 'Test Customer', customerPhone: '0901234567', tableNumber: 5, notes: 'Less ice',
      items: [{ productId, quantity: 1 }], ...extra,
    });
  const checkout = (orderId: string, amount = 35000) => request(context.app.getHttpServer())
    .post('/payments/sepay/checkout').set('Idempotency-Key', `payment-${orderId}`).send({ orderId, amount });
  const proof = (orderId: string) => ({
    timestamp: Date.now(), notification_type: 'ORDER_PAID',
    order: { order_invoice_number: orderId, order_status: 'CAPTURED', order_amount: '35000', order_currency: 'VND' },
    transaction: { transaction_id: `gateway-${orderId}`, transaction_type: 'PAYMENT',
      transaction_status: 'APPROVED', transaction_amount: '35000', transaction_currency: 'VND' },
  });
  const ipn = (payload: ReturnType<typeof proof>, secret = process.env.SEPAY_IPN_SECRET_KEY!) =>
    request(context.app.getHttpServer()).post('/payments/sepay/webhook-ipn').set('x-secret-key', secret).send(payload);
  const history = (token: string) => request(context.app.getHttpServer())
    .get('/orders/history').auth(token, { type: 'bearer' });

  it('INT-PROD-03: loads available size/topping options and saves their authoritative price and quantities (FR-03)', async () => {
    const configuration = await request(context.app.getHttpServer()).get('/products/configuration').expect(200);
    expect(configuration.body.success).toBe(true);
    expect(configuration.body.data.sizes).toEqual(expect.arrayContaining([
      { id: 'S', label: 'Nhỏ', priceAdjustment: -5000 },
      { id: 'M', label: 'Vừa', priceAdjustment: 0 },
      { id: 'L', label: 'Lớn', priceAdjustment: 5000 },
    ]));
    expect(configuration.body.data.toppings).toContainEqual({ id: 'pearls', name: 'Trân châu đen', unitPrice: 7000 });
    const response = await place({ items: [{
      productId, quantity: 2, size: 'L', toppings: 'Trân châu đen x2', unitPrice: 1, itemTotal: 2,
    }] }).expect(201);
    expect(response.body).toMatchObject({ subtotalAmount: 108000, totalAmount: 108000 });
    expect(response.body.items).toEqual([expect.objectContaining({
      productId, size: 'L', toppings: 'Trân châu đen x2', quantity: 2, unitPrice: 54000, itemTotal: 108000,
    })]);
    expect(await context.prisma.orderItem.findMany({ where: { orderId: response.body.id } }))
      .toEqual(response.body.items);
    expect(await context.prisma.product.findUniqueOrThrow({ where: { id: productId } })).toMatchObject({ stock: 8, version: 1 });
  });

  it.each([
    { label: 'unknown size', size: 'XL' },
    { label: 'inactive size', size: 'L', disabledSize: 'L' },
    { label: 'unknown topping', toppings: 'Unknown topping' },
    { label: 'inactive topping', toppings: 'Trân châu đen', disabledTopping: 'pearls' },
    { label: 'zero topping quantity', toppings: 'Trân châu đen x0' },
    { label: 'excess topping quantity', toppings: 'Trân châu đen x6' },
  ])('INT-PROD-03: rejects $label and rolls back stock/order writes', async (option) => {
    if (option.disabledSize) await context.prisma.drinkSizeOption.update({
      where: { id: option.disabledSize }, data: { isActive: false },
    });
    if (option.disabledTopping) await context.prisma.toppingOption.update({
      where: { id: option.disabledTopping }, data: { isActive: false },
    });
    const configuration = await request(context.app.getHttpServer()).get('/products/configuration').expect(200);
    if (option.disabledSize) expect(configuration.body.data.sizes)
      .not.toEqual(expect.arrayContaining([expect.objectContaining({ id: option.disabledSize })]));
    if (option.disabledTopping) expect(configuration.body.data.toppings)
      .not.toEqual(expect.arrayContaining([expect.objectContaining({ id: option.disabledTopping })]));
    await place({ items: [{ productId, quantity: 1, size: option.size, toppings: option.toppings }] }).expect(400);
    expect(await context.prisma.order.count()).toBe(0);
    expect(await context.prisma.orderItem.count()).toBe(0);
    expect(await context.prisma.product.findUniqueOrThrow({ where: { id: productId } })).toMatchObject({ stock: 10, version: 0 });
  });

  it('INT-ORD-01: creates an owned order with contact details and immutable server-priced item snapshots (FR-08/09/10)', async () => {
    const response = await place({ userId: otherId, items: [{
      productId, productName: 'Forged name', unitPrice: 1, itemTotal: 2, quantity: 2, size: 'M',
    }] }).expect(201);
    expect(response.body.id).toEqual(expect.any(String));
    expect(response.body).toMatchObject({ userId: customerId, status: 'PENDING', customerName: 'Test Customer',
      customerPhone: '0901234567', tableNumber: 5, notes: 'Less ice', subtotalAmount: 70000, totalAmount: 70000 });
    expect(response.body.items).toEqual([expect.objectContaining({
      productId, productName: 'Traceability Coffee', unitPrice: 35000, quantity: 2, size: 'M', itemTotal: 70000,
    })]);
    const persisted = await context.prisma.order.findUniqueOrThrow({ where: { id: response.body.id }, include: { items: true } });
    expect(JSON.parse(JSON.stringify(persisted))).toEqual(response.body);
    await context.prisma.product.update({ where: { id: productId }, data: { name: 'Renamed coffee', price: 99000 } });
    expect(await context.prisma.order.findUniqueOrThrow({ where: { id: persisted.id }, include: { items: true } })).toEqual(persisted);
  });

  it('E2E-ORD-02: customer status reads follow payment and every preparation step persisted by staff (FR-11)', async () => {
    const { body: order } = await place().expect(201);
    const assertStatus = async (status: string) => {
      const response = await request(context.app.getHttpServer()).get(`/orders/${order.id}/status`).expect(200);
      const persisted = await context.prisma.order.findUniqueOrThrow({ where: { id: order.id } });
      expect(response.body).toMatchObject({ id: order.id, status, totalAmount: 35000, customerName: 'Test Customer',
        updatedAt: persisted.updatedAt.toISOString() });
    };
    await assertStatus('PENDING');
    await checkout(order.id).expect(201);
    await ipn(proof(order.id)).expect(200);
    await assertStatus('PAID');
    for (const status of ['PREPARING', 'READY', 'COMPLETED']) {
      await request(context.app.getHttpServer()).patch(`/staff/orders/${order.id}/status`)
        .auth(staffToken, { type: 'bearer' }).send({ status }).expect(200);
      await assertStatus(status);
    }
  });

  it('E2E-ORD-02: status lookup of an unknown order returns 404', async () => {
    await request(context.app.getHttpServer()).get('/orders/missing-traceability-order/status').expect(404);
  });

  it('INT-ORD-06: history returns only the current account orders, newest first, with item/payment snapshots (FR-13)', async () => {
    const { body: older } = await place().expect(201);
    const { body: newer } = await place().expect(201);
    const { body: other } = await place({}, otherToken).expect(201);
    await context.prisma.order.update({ where: { id: older.id }, data: { createdAt: new Date('2026-01-01T01:00:00Z') } });
    await context.prisma.order.update({ where: { id: newer.id }, data: { createdAt: new Date('2026-01-02T01:00:00Z') } });
    await checkout(newer.id).expect(201);
    await ipn(proof(newer.id)).expect(200);
    const response = await history(customerToken).query({ userId: otherId }).expect(200);
    expect(response.body.map((order: { id: string }) => order.id)).toEqual([newer.id, older.id]);
    expect(response.body[0]).toMatchObject({ userId: customerId, status: 'PAID', totalAmount: 35000,
      items: [expect.objectContaining({ productId, productName: 'Traceability Coffee', itemTotal: 35000 })],
      payment: { orderId: newer.id, amount: 35000, status: 'SUCCESS', transactionRef: `gateway-${newer.id}` } });
    const otherHistory = await history(otherToken).query({ userId: customerId }).expect(200);
    expect(otherHistory.body.map((order: { id: string }) => order.id)).toEqual([other.id]);
  });

  it('INT-ORD-06: an account with no orders gets an empty history', async () => {
    await place().expect(201);
    const response = await history(otherToken).expect(200);
    expect(response.body).toEqual([]);
  });

  it.each(['missing', 'malformed', 'expired'])('INT-ORD-06: rejects %s authentication for history (FR-13/17)', async (credential) => {
    const read = request(context.app.getHttpServer()).get('/orders/history');
    if (credential === 'malformed') read.auth('invalid-token', { type: 'bearer' });
    if (credential === 'expired') {
      const expired = context.app.get(AuthService).generateToken({
        userId: customerId, email: 'customer-traceability@example.test', fullName: 'Customer', role: Role.CUSTOMER,
      }, -10);
      read.auth(expired, { type: 'bearer' });
    }
    await read.expect(401);
  });

  it('INT-PAY-01: checkout persists the exact order amount and selected SePay method in a usable QR (FR-18/19)', async () => {
    const { body: order } = await place().expect(201);
    const { body: payment } = await checkout(order.id).expect(201);
    expect(payment).toMatchObject({ orderId: order.id, method: 'SEPAY_QR', amount: 35000, status: 'PENDING', paidAt: null });
    const qr = new URL(payment.qrUrl);
    expect(qr.origin).toBe('https://qr.sepay.vn');
    expect(qr.searchParams.get('amount')).toBe('35000');
    expect(qr.searchParams.get('des')).toBe(payment.transactionRef);
    const saved = await context.prisma.payment.findUniqueOrThrow({ where: { orderId: order.id } });
    expect(JSON.parse(JSON.stringify(saved))).toEqual(payment);
    expect((await context.prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe('PENDING');
  });

  it.each([1, 34999, 35001])('INT-PAY-01: mismatched amount %s cannot create a payment (FR-19)', async (amount) => {
    const { body: order } = await place().expect(201);
    await checkout(order.id, amount).expect(400);
    expect(await context.prisma.payment.count()).toBe(0);
    expect((await context.prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe('PENDING');
  });

  it('INT-PAY-02: authenticated successful IPN persists its transaction and confirms PAID only once (FR-20/21)', async () => {
    const { body: order } = await place().expect(201);
    await checkout(order.id).expect(201);
    const payload = proof(order.id);
    const response = await ipn(payload).expect(200);
    expect(response.body).toEqual({ success: true });
    const saved = await context.prisma.payment.findUniqueOrThrow({ where: { orderId: order.id } });
    expect(saved).toMatchObject({ status: 'SUCCESS', amount: 35000, transactionRef: payload.transaction.transaction_id, paidAt: expect.any(Date) });
    expect(await context.prisma.order.findUniqueOrThrow({ where: { id: order.id } }))
      .toMatchObject({ status: 'PAID', reservationStatus: 'CONSUMED', reservationExpiresAt: null });
    const replay = await ipn(payload).expect(200);
    expect(replay.body).toEqual({ success: true, alreadyProcessed: true });
    expect(await context.prisma.payment.findUniqueOrThrow({ where: { orderId: order.id } })).toEqual(saved);
    expect(await context.prisma.product.findUniqueOrThrow({ where: { id: productId } })).toMatchObject({ stock: 9, version: 1 });
  });

  it.each(['wrong secret', 'declined transaction', 'wrong amount'])('INT-PAY-02: %s cannot mark the order paid (FR-20)', async (scenario) => {
    const { body: order } = await place().expect(201);
    await checkout(order.id).expect(201);
    const savedOrder = await context.prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    const savedPayment = await context.prisma.payment.findUniqueOrThrow({ where: { orderId: order.id } });
    const payload = proof(order.id);
    let expectedStatus = 401;
    if (scenario === 'declined transaction') {
      payload.transaction.transaction_status = 'DECLINED';
      expectedStatus = 400;
    } else if (scenario === 'wrong amount') {
      payload.order.order_amount = '1';
      payload.transaction.transaction_amount = '1';
      expectedStatus = 409;
    }
    await ipn(payload, scenario === 'wrong secret' ? 'invalid-secret' : undefined).expect(expectedStatus);
    expect(await context.prisma.order.findUniqueOrThrow({ where: { id: order.id } })).toEqual(savedOrder);
    expect(await context.prisma.payment.findUniqueOrThrow({ where: { orderId: order.id } })).toEqual(savedPayment);
    expect(await context.prisma.loyaltyTransaction.count()).toBe(0);
  });
});
