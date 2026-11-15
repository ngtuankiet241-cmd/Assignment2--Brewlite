import request = require('supertest');
import { OrderStatus, Role } from '@prisma/client';
import { AuthService } from '../src/auth/auth.service';
import { createTestApplication, TestApplication } from './helpers/test-app';

// Allowed edges taken from the requested state diagram, not from the code under test.
const allowed: [OrderStatus, OrderStatus][] = [
  ['PENDING', 'PAID'], ['PENDING', 'PAYMENT_FAILED'], ['PENDING', 'CANCELLED'],
  ['PAYMENT_FAILED', 'PENDING'], ['PAYMENT_FAILED', 'CANCELLED'],
  ['PAID', 'PREPARING'], ['PAID', 'CANCELLED'],
  ['PREPARING', 'READY'], ['READY', 'COMPLETED'],
];
const forbidden = Object.values(OrderStatus).flatMap((from) =>
  Object.values(OrderStatus).filter((to) => !allowed.some(([a, b]) => a === from && b === to))
    .map((to) => [from, to] as [OrderStatus, OrderStatus]),
);

describe('Order State Machine (HTTP + PostgreSQL integration)', () => {
  let context: TestApplication;
  let staffToken: string;
  beforeAll(async () => {
    context = await createTestApplication();
    staffToken = context.app.get(AuthService).generateToken({
      userId: 'state-machine-staff', email: 'staff@example.test', role: Role.BARISTA, fullName: 'Staff Test',
    });
  });
  beforeEach(async () => {
    await context.prisma.payment.deleteMany();
    await context.prisma.order.deleteMany();
  });
  afterAll(async () => { await context?.close(); });

  const createOrder = (status: OrderStatus = OrderStatus.PENDING) => context.prisma.order.create({
    data: { status, customerName: 'State Machine Test', customerPhone: '0900000000', totalAmount: 70000 },
  });
  const patch = (id: string, status: unknown) => request(context.app.getHttpServer())
    .patch(`/orders/${id}/status`).auth(staffToken, { type: 'bearer' }).send({ status });
  const checkout = (orderId: string, key: string) => request(context.app.getHttpServer())
    .post('/payments/sepay/checkout').send({ orderId, amount: 70000, idempotencyKey: key });
  const ipn = (orderId: string, status: 'SUCCESS' | 'FAILED', transactionRef: string) => request(context.app.getHttpServer())
    .post('/payments/sepay/webhook-ipn').send({ orderId, status, transactionRef, amount: 70000 });

  it.each(allowed)('INT-SM-01: persists the allowed transition %s -> %s', async (from, to) => {
    const order = await createOrder(from);
    const response = await patch(order.id, to).expect(200);
    expect(response.body.status).toBe(to);
    expect((await context.prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe(to);
  });

  it.each(forbidden)('INT-SM-02: rejects %s -> %s with 409 and leaves the database unchanged', async (from, to) => {
    const order = await createOrder(from);
    const response = await patch(order.id, to).expect(409);
    expect(response.body).toMatchObject({ currentStatus: from, requestedStatus: to });
    expect(await context.prisma.order.findUniqueOrThrow({ where: { id: order.id } })).toEqual(order);
  });

  it.each([undefined, null, '', 'SHIPPED', 123, {}])('INT-SM-03: invalid status (%#) returns 400 without modifying the order', async (status) => {
    const order = await createOrder();
    await patch(order.id, status).expect(400);
    expect(await context.prisma.order.findUniqueOrThrow({ where: { id: order.id } })).toEqual(order);
  });

  it('INT-SM-04: a missing order returns 404', async () => {
    await patch('missing-order-id', 'PAID').expect(404);
  });

  it('INT-SM-05: completes the normal payment and preparation flow', async () => {
    const order = await createOrder();
    await checkout(order.id, 'normal-attempt').expect(201);
    await ipn(order.id, 'SUCCESS', 'normal-success').expect(201);
    for (const status of ['PREPARING', 'READY', 'COMPLETED']) {
      await patch(order.id, status).expect(200);
    }
    expect((await context.prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe('COMPLETED');
    expect((await context.prisma.payment.findUniqueOrThrow({ where: { orderId: order.id } })).status).toBe('SUCCESS');
  });

  it('INT-SM-06: failed payment can be retried through PAYMENT_FAILED -> PENDING -> PAID', async () => {
    const order = await createOrder();
    await checkout(order.id, 'failed-attempt').expect(201);
    await ipn(order.id, 'FAILED', 'failed-event').expect(201);
    expect((await context.prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe('PAYMENT_FAILED');
    expect((await context.prisma.payment.findUniqueOrThrow({ where: { orderId: order.id } })).status).toBe('FAILED');

    // Replaying the old request does not create a new attempt or reset the order.
    const replay = await checkout(order.id, 'failed-attempt').expect(201);
    expect(replay.body.status).toBe('FAILED');
    expect((await context.prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe('PAYMENT_FAILED');

    const retry = await checkout(order.id, 'retry-attempt').expect(201);
    expect(retry.body.status).toBe('PENDING');
    expect(retry.body.paidAt).toBeNull();
    expect((await context.prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe('PENDING');
    await ipn(order.id, 'SUCCESS', 'retry-success').expect(201);
    expect((await context.prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe('PAID');
  });

  it('INT-SM-07: late IPN cannot reopen a cancelled order or modify its payment', async () => {
    const order = await createOrder();
    await checkout(order.id, 'cancel-attempt').expect(201);
    await patch(order.id, 'CANCELLED').expect(200);
    const before = await context.prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    const payment = await context.prisma.payment.findUniqueOrThrow({ where: { orderId: order.id } });
    await ipn(order.id, 'SUCCESS', 'late-success').expect(409);
    expect(await context.prisma.order.findUniqueOrThrow({ where: { id: order.id } })).toEqual(before);
    expect(await context.prisma.payment.findUniqueOrThrow({ where: { orderId: order.id } })).toEqual(payment);
  });

  it('INT-SM-08: exact IPN replay leaves completed order and payment unchanged; failure cannot downgrade success', async () => {
    const order = await createOrder();
    await checkout(order.id, 'replay-attempt').expect(201);
    await ipn(order.id, 'SUCCESS', 'paid-event').expect(201);
    for (const status of ['PREPARING', 'READY', 'COMPLETED']) await patch(order.id, status).expect(200);
    const before = await context.prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    const payment = await context.prisma.payment.findUniqueOrThrow({ where: { orderId: order.id } });
    await ipn(order.id, 'SUCCESS', 'paid-event').expect(201);
    await ipn(order.id, 'FAILED', 'late-failure').expect(409);
    expect(await context.prisma.order.findUniqueOrThrow({ where: { id: order.id } })).toEqual(before);
    expect(await context.prisma.payment.findUniqueOrThrow({ where: { orderId: order.id } })).toEqual(payment);
    // Original checkout request is also replayable without starting a new payment.
    const replay = await checkout(order.id, 'replay-attempt').expect(201);
    expect(replay.body.status).toBe('SUCCESS');
  });

  it.each(['PAID', 'PREPARING', 'READY', 'COMPLETED', 'CANCELLED'] as OrderStatus[])
    ('INT-SM-09: checkout cannot create a new attempt for %s', async (status) => {
      const order = await createOrder(status);
      await checkout(order.id, 'new-attempt').expect(409);
      expect(await context.prisma.payment.count()).toBe(0);
      expect(await context.prisma.order.findUniqueOrThrow({ where: { id: order.id } })).toEqual(order);
    });

  it('INT-SM-10: order update rolls back if the payment write violates a transaction reference constraint', async () => {
    const order = await createOrder();
    const otherOrder = await createOrder();
    await context.prisma.payment.create({ data: { orderId: otherOrder.id, amount: 70000, transactionRef: 'occupied-ref' } });
    const payment = await context.prisma.payment.create({ data: { orderId: order.id, amount: 70000, transactionRef: 'initial-ref' } });
    await ipn(order.id, 'SUCCESS', 'occupied-ref').expect(409);
    expect(await context.prisma.order.findUniqueOrThrow({ where: { id: order.id } })).toEqual(order);
    expect(await context.prisma.payment.findUniqueOrThrow({ where: { orderId: order.id } })).toEqual(payment);
  });

  it('INT-SM-11: concurrent incompatible status requests cannot both succeed', async () => {
    const order = await createOrder();
    const responses = await Promise.all([patch(order.id, 'PAID'), patch(order.id, 'PAYMENT_FAILED')]);
    expect(responses.map((response) => response.status).sort()).toEqual([200, 409]);
    const winner = responses.find((response) => response.status === 200);
    expect((await context.prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe(winner.body.status);
  });

  it('INT-SM-12: concurrent success/failure callbacks preserve a consistent order and payment pair', async () => {
    const order = await createOrder();
    await checkout(order.id, 'concurrent-attempt').expect(201);
    const responses = await Promise.all([ipn(order.id, 'SUCCESS', 'concurrent-success'), ipn(order.id, 'FAILED', 'concurrent-failure')]);
    expect(responses.map((response) => response.status).sort()).toEqual([201, 409]);
    const stored = await context.prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    const payment = await context.prisma.payment.findUniqueOrThrow({ where: { orderId: order.id } });
    expect([['PAID', 'SUCCESS'], ['PAYMENT_FAILED', 'FAILED']]).toContainEqual([stored.status, payment.status]);
  });
});
