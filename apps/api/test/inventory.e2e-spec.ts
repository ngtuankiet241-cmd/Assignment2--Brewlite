import request = require('supertest');
import { Role } from '@prisma/client';
import { AuthService } from '../src/auth/auth.service';
import { InventoryService } from '../src/inventory/inventory.service';
import { OrdersService } from '../src/orders/orders.service';
import { createTestApplication, TestApplication } from './helpers/test-app';

describe('Inventory reservations (HTTP + PostgreSQL integration)', () => {
  let context: TestApplication;
  let inventory: InventoryService;
  let staffToken: string;

  beforeAll(async () => {
    context = await createTestApplication();
    // Bind once so all concurrent Supertest requests share the listening server.
    await context.app.listen(0, '127.0.0.1');
    inventory = context.app.get(InventoryService);
    staffToken = context.app.get(AuthService).generateToken({
      userId: 'inventory-staff', email: 'staff@example.test', role: Role.BARISTA, fullName: 'Staff Test',
    });
  });
  beforeEach(async () => {
    await context.prisma.order.deleteMany();
    await context.prisma.product.deleteMany();
  });
  afterAll(async () => { await context?.close(); });

  const product = (stock: number, id?: string) => context.prisma.product.create({
    data: { ...(id ? { id } : {}), name: 'Inventory Coffee', description: 'Test', price: 10000, imageUrl: '', stock },
  });
  const item = (id: string, quantity = 1, size = 'M') => ({
    productId: id, productName: 'Inventory Coffee', quantity, size, unitPrice: 10000, itemTotal: quantity * 10000,
  });
  const payload = (items: ReturnType<typeof item>[]) => ({
    customerName: 'Inventory Test', customerPhone: '0900000000', items,
  });
  const place = (items: ReturnType<typeof item>[]) => request(context.app.getHttpServer())
    .post('/orders').send(payload(items));
  const stock = (id: string) => context.prisma.product.findUniqueOrThrow({ where: { id } });
  const order = (id: string) => context.prisma.order.findUniqueOrThrow({ where: { id } });
  const expire = (id: string) => context.prisma.order.update({
    where: { id }, data: { reservationExpiresAt: new Date(Date.now() - 1000) },
  });
  const patch = (id: string, status: string) => request(context.app.getHttpServer())
    .patch(`/orders/${id}/status`).auth(staffToken, { type: 'bearer' }).send({ status });
  const checkout = (orderId: string, amount = 10000) => request(context.app.getHttpServer())
    .post('/payments/sepay/checkout').send({ orderId, amount, idempotencyKey: `key-${orderId}` });
  const ipn = (orderId: string, status = 'SUCCESS', amount = 10000) => request(context.app.getHttpServer())
    .post('/payments/sepay/webhook-ipn').send({ orderId, amount, status, transactionRef: `ref-${orderId}` });

  it.each([1, 2, 3])('INT-INV-01: 30 simultaneous orders cannot exceed 7 units (round %s)', async () => {
    const p = await product(7);
    const responses = await Promise.all(Array.from({ length: 30 }, () => place([item(p.id)])));
    expect(responses.map((response) => response.status).sort()).toEqual([
      ...Array(7).fill(201), ...Array(23).fill(409),
    ]);
    const successful = responses.filter((response) => response.status === 201);
    expect(successful).toHaveLength(7);
    expect(await context.prisma.order.count()).toBe(7);
    expect(await context.prisma.orderItem.aggregate({ _sum: { quantity: true } }))
      .toMatchObject({ _sum: { quantity: 7 } });
    expect(await stock(p.id)).toMatchObject({ stock: 0, version: 7 });
    for (const response of successful) {
      expect(response.body.reservationStatus).toBe('HELD');
      const ttl = new Date(response.body.reservationExpiresAt).getTime() - new Date(response.body.createdAt).getTime();
      expect(ttl).toBeGreaterThan(inventory.reservationTtlMs - 5000);
      expect(ttl).toBeLessThan(inventory.reservationTtlMs + 5000);
    }
  });

  it('INT-INV-02: simultaneous multi-product carts respect every stock limit, regardless of item order', async () => {
    const a = await product(5);
    const b = await product(3);
    const responses = await Promise.all(Array.from({ length: 20 }, (_, index) =>
      place(index % 2 ? [item(a.id, 2), item(b.id)] : [item(b.id), item(a.id, 2)]),
    ));
    expect(responses.filter((response) => response.status === 201)).toHaveLength(2);
    expect(responses.every((response) => [201, 409].includes(response.status))).toBe(true);
    expect(await stock(a.id)).toMatchObject({ stock: 1, version: 2 });
    expect(await stock(b.id)).toMatchObject({ stock: 1, version: 2 });
    expect(await context.prisma.order.count()).toBe(2);
  });

  it('INT-INV-03: size/topping lines share one product stock budget', async () => {
    const p = await product(3);
    await place([item(p.id, 2, 'M'), item(p.id, 2, 'L')]).expect(409);
    expect(await stock(p.id)).toEqual(p);
    expect(await context.prisma.order.count()).toBe(0);
  });

  it.each([0, -1, 1.5, '1', null, 2147483648])('INT-INV-04: invalid quantity %s cannot alter stock', async (quantity) => {
    const p = await product(3);
    await request(context.app.getHttpServer()).post('/orders')
      .send(payload([{ ...item(p.id), quantity: quantity as number }])).expect(400);
    expect(await stock(p.id)).toEqual(p);
    expect(await context.prisma.order.count()).toBe(0);
  });

  it('INT-INV-05: a later out-of-stock product rolls back earlier decrements and versions', async () => {
    const a = await product(3, 'inventory-a');
    const z = await product(0, 'inventory-z');
    await place([item(a.id), item(z.id)]).expect(409);
    expect(await stock(a.id)).toEqual(a);
    expect(await stock(z.id)).toEqual(z);
    expect(await context.prisma.order.count()).toBe(0);
  });

  it('INT-INV-06: failed order insertion rolls back the inventory update', async () => {
    const p = await product(3);
    await expect(context.app.get(OrdersService).create({
      ...payload([item(p.id, 2)]), userId: 'nonexistent-user',
    })).rejects.toMatchObject({ code: 'P2003' });
    expect(await stock(p.id)).toEqual(p);
    expect(await context.prisma.order.count()).toBe(0);
  });

  it.each(['PENDING', 'PAYMENT_FAILED'])('INT-INV-07: TTL cancels %s and returns stock once', async (status) => {
    const p = await product(3);
    const placed = await place([item(p.id, 2)]).expect(201);
    if (status === 'PAYMENT_FAILED') await patch(placed.body.id, status).expect(200);
    await expire(placed.body.id);
    const response = await request(context.app.getHttpServer()).get(`/orders/${placed.body.id}/status`).expect(200);
    expect(response.body.status).toBe('CANCELLED');
    expect(await order(placed.body.id)).toMatchObject({ reservationStatus: 'RELEASED', reservationExpiresAt: null });
    const restored = await stock(p.id);
    expect(restored).toMatchObject({ stock: 3, version: 2 });
    await expect(inventory.expireReservations()).resolves.toBe(0);
    expect(await stock(p.id)).toEqual(restored);
  });

  it('INT-INV-08: a new order reclaims expired reservations without waiting for the background sweep', async () => {
    const p = await product(3);
    const first = await place([item(p.id, 1, 'M'), item(p.id, 2, 'L')]).expect(201);
    expect((await stock(p.id)).stock).toBe(0);
    await expire(first.body.id);
    const next = await place([item(p.id, 3)]).expect(201);
    expect(next.body.reservationStatus).toBe('HELD');
    expect(await order(first.body.id)).toMatchObject({ status: 'CANCELLED', reservationStatus: 'RELEASED' });
    expect(await stock(p.id)).toMatchObject({ stock: 0, version: 3 });
  });

  it('INT-INV-09: concurrent sweepers, cancellation and late IPN cannot restore stock twice', async () => {
    const p = await product(3);
    const placed = await place([item(p.id, 3)]).expect(201);
    await checkout(placed.body.id, 30000).expect(201);
    await expire(placed.body.id);
    const responses = await Promise.all([
      ...Array.from({ length: 6 }, () => inventory.expireReservations()),
      patch(placed.body.id, 'CANCELLED'), ipn(placed.body.id, 'SUCCESS', 30000),
    ]);
    expect((responses[7] as request.Response).status).toBe(409);
    expect(await order(placed.body.id)).toMatchObject({ status: 'CANCELLED', reservationStatus: 'RELEASED' });
    expect(await stock(p.id)).toMatchObject({ stock: 3, version: 2 });
    expect((await context.prisma.payment.findUniqueOrThrow({ where: { orderId: placed.body.id } })).status)
      .toBe('PENDING');
  });

  it('INT-INV-10: successful payment consumes the hold; replay and TTL do not decrement or return stock', async () => {
    const p = await product(3);
    const placed = await place([item(p.id)]).expect(201);
    await checkout(placed.body.id).expect(201);
    await ipn(placed.body.id).expect(201);
    expect(await order(placed.body.id)).toMatchObject({ status: 'PAID', reservationStatus: 'CONSUMED', reservationExpiresAt: null });
    const afterPayment = await stock(p.id);
    expect(afterPayment).toMatchObject({ stock: 2, version: 1 });
    await ipn(placed.body.id).expect(201);
    await inventory.expireReservations();
    expect(await stock(p.id)).toEqual(afterPayment);
  });

  it('INT-INV-11: expired checkout, including the original idempotency key, rejects without changing payment', async () => {
    const p = await product(1);
    const placed = await place([item(p.id)]).expect(201);
    await checkout(placed.body.id).expect(201);
    const payment = await context.prisma.payment.findUniqueOrThrow({ where: { orderId: placed.body.id } });
    await expire(placed.body.id);
    await checkout(placed.body.id).expect(409);
    await ipn(placed.body.id).expect(409);
    expect(await context.prisma.payment.findUniqueOrThrow({ where: { orderId: placed.body.id } })).toEqual(payment);
    expect(await stock(p.id)).toMatchObject({ stock: 1, version: 2 });
  });

  it.each(['PENDING', 'PAID'])('INT-INV-12: cancelling %s releases its inventory exactly once', async (status) => {
    const p = await product(3);
    const placed = await place([item(p.id, 2)]).expect(201);
    if (status === 'PAID') await patch(placed.body.id, 'PAID').expect(200);
    await patch(placed.body.id, 'CANCELLED').expect(200);
    const restored = await stock(p.id);
    expect(restored).toMatchObject({ stock: 3, version: 2 });
    await patch(placed.body.id, 'CANCELLED').expect(409);
    await inventory.expireReservations();
    expect(await stock(p.id)).toEqual(restored);
  });

  it('INT-INV-13: PostgreSQL permits only one conditional update using the same stock version', async () => {
    const p = await product(4);
    const responses = await Promise.all(Array.from({ length: 2 }, () => context.prisma.product.updateMany({
      where: { id: p.id, version: p.version, stock: { gte: 1 } },
      data: { stock: { decrement: 1 }, version: { increment: 1 } },
    })));
    expect(responses.map((result) => result.count).sort()).toEqual([0, 1]);
    expect(await stock(p.id)).toMatchObject({ stock: 3, version: 1 });
  });

  it('INT-INV-14: database constraint rejects negative stock even outside checkout', async () => {
    const p = await product(1);
    await expect(context.prisma.product.update({ where: { id: p.id }, data: { stock: -1 } })).rejects.toThrow();
    expect(await stock(p.id)).toEqual(p);
  });

  it.each(['checkout', 'ipn'])('INT-INV-15: %s rechecks TTL after cleanup, inside the locked transaction', async (operation) => {
    const p = await product(1);
    const placed = await place([item(p.id)]).expect(201);
    await checkout(placed.body.id).expect(201);
    const payment = await context.prisma.payment.findUniqueOrThrow({ where: { orderId: placed.body.id } });
    const realCleanup = inventory.expireReservations.bind(inventory);
    // Deterministically cross the deadline between the initial cleanup and lock.
    // The order/payment/stock operations still execute against real PostgreSQL.
    const cleanup = jest.spyOn(inventory, 'expireReservations').mockImplementationOnce(async (id) => {
      const count = await realCleanup(id);
      await expire(placed.body.id);
      return count;
    });
    try {
      await (operation === 'checkout' ? checkout(placed.body.id) : ipn(placed.body.id)).expect(409);
      expect(await order(placed.body.id)).toMatchObject({ status: 'PENDING', reservationStatus: 'HELD' });
      expect(await context.prisma.payment.findUniqueOrThrow({ where: { orderId: placed.body.id } })).toEqual(payment);
      expect(await stock(p.id)).toMatchObject({ stock: 0, version: 1 });
    } finally {
      cleanup.mockRestore();
    }
    await inventory.expireReservations();
    expect(await stock(p.id)).toMatchObject({ stock: 1, version: 2 });
  });

  it('INT-INV-16: payment write failure rolls back consumption and preserves the original hold', async () => {
    const p = await product(2);
    const first = await place([item(p.id)]).expect(201);
    const second = await place([item(p.id)]).expect(201);
    await checkout(first.body.id).expect(201);
    await ipn(first.body.id).expect(201);
    await checkout(second.body.id).expect(201);
    const heldOrder = await order(second.body.id);
    const before = await stock(p.id);
    await request(context.app.getHttpServer()).post('/payments/sepay/webhook-ipn')
      .send({ orderId: second.body.id, amount: 10000, status: 'SUCCESS', transactionRef: `ref-${first.body.id}` })
      .expect(409);
    expect(await order(second.body.id)).toEqual(heldOrder);
    expect(await stock(p.id)).toEqual(before);
    expect((await context.prisma.payment.findUniqueOrThrow({ where: { orderId: second.body.id } })).status).toBe('PENDING');
  });
});
