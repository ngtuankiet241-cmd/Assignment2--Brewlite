import request = require('supertest');
import { OrderStatus, Role } from '@prisma/client';
import { AuthService } from '../src/auth/auth.service';
import { createTestApplication, TestApplication } from './helpers/test-app';

describe('Staff API (HTTP + PostgreSQL integration)', () => {
  let context: TestApplication;
  const tokens: Partial<Record<Role, string>> = {};

  beforeAll(async () => {
    context = await createTestApplication();
    await context.app.listen(0, '127.0.0.1');
    const auth = context.app.get(AuthService);
    for (const role of [Role.CUSTOMER, Role.BARISTA, Role.ADMIN]) {
      const email = `${role.toLowerCase()}@staff.example.test`;
      await context.prisma.user.create({ data: {
        email, role, fullName: `${role} Test`, password: auth.hashPassword('StaffTest!123'),
      } });
      const login = await request(context.app.getHttpServer()).post('/auth/login')
        .send({ email, password: 'StaffTest!123' }).expect(201);
      tokens[role] = login.body.accessToken;
    }
  });
  beforeEach(async () => {
    await context.prisma.order.deleteMany();
    await context.prisma.product.deleteMany();
  });
  afterAll(async () => { await context?.close(); });

  const createOrder = (status: OrderStatus = OrderStatus.PAID, createdAt = new Date()) =>
    context.prisma.order.create({ data: {
      status, createdAt, customerName: 'Khách tại quầy', customerPhone: '0900000000',
      tableNumber: 3, notes: 'Ít đá', totalAmount: 30000,
    } });
  const get = (path: string, role: Role = Role.BARISTA) => request(context.app.getHttpServer())
    .get(path).auth(tokens[role], { type: 'bearer' });
  const patch = (id: string, status: unknown, role: Role = Role.BARISTA) => request(context.app.getHttpServer())
    .patch(`/staff/orders/${id}/status`).auth(tokens[role], { type: 'bearer' }).send({ status });

  it.each([
    ['get', '/staff'],
    ['get', '/staff/orders'],
    ['get', '/staff/orders/any-order'],
    ['patch', '/staff/orders/any-order/status'],
    ['patch', '/orders/any-order/status'],
  ])('INT-STAFF-01: %s %s requires staff authorization', async (method, path) => {
    const http = context.app.getHttpServer();
    const send = () => method === 'get' ? request(http).get(path) : request(http).patch(path).send({ status: 'READY' });
    await send().expect(401);
    await send().auth(tokens.CUSTOMER, { type: 'bearer' }).expect(403);
  });

  it('INT-STAFF-02: rejects forged and expired tokens', async () => {
    await request(context.app.getHttpServer()).get('/staff').auth('invalid-token', { type: 'bearer' }).expect(401);
    const expired = context.app.get(AuthService).generateToken({
      userId: 'expired-staff', email: 'expired@example.test', role: Role.ADMIN, fullName: 'Expired Staff',
    }, -10);
    await request(context.app.getHttpServer()).get('/staff').auth(expired, { type: 'bearer' }).expect(401);
  });

  it('INT-STAFF-03: public registration cannot grant a staff role', async () => {
    const registered = await request(context.app.getHttpServer()).post('/auth/register').send({
      email: 'self-promote@staff.example.test', password: 'Password!123', fullName: 'Customer', role: 'ADMIN',
    }).expect(201);
    expect(registered.body.user.role).toBe('CUSTOMER');
    await request(context.app.getHttpServer()).get('/staff')
      .auth(registered.body.accessToken, { type: 'bearer' }).expect(403);
  });

  it.each([Role.BARISTA, Role.ADMIN])('INT-STAFF-04: %s can list, inspect and process orders', async (role) => {
    const order = await createOrder();
    const list = await get('/staff/orders', role).expect(200);
    expect(list.body.data.map((entry) => entry.id)).toEqual([order.id]);
    await get(`/staff/orders/${order.id}`, role).expect(200);
    for (const status of ['PREPARING', 'READY', 'COMPLETED']) {
      const response = await patch(order.id, status, role).expect(200);
      expect(response.body.status).toBe(status);
    }
    expect((await context.prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe('COMPLETED');
  });

  it('INT-STAFF-05: filters and paginates oldest orders first with an accurate total', async () => {
    const older = await createOrder(OrderStatus.PAID, new Date('2026-11-10T01:00:00Z'));
    const newer = await createOrder(OrderStatus.PAID, new Date('2026-11-10T02:00:00Z'));
    await createOrder(OrderStatus.COMPLETED);
    const first = await get('/staff?status=PAID&limit=1').expect(200);
    expect(first.body.data.map((entry) => entry.id)).toEqual([older.id]);
    expect(first.body.pagination).toEqual({ page: 1, limit: 1, total: 2, totalPages: 2 });
    const second = await get('/staff/orders?status=PAID&limit=1&page=2').expect(200);
    expect(second.body.data.map((entry) => entry.id)).toEqual([newer.id]);
    expect(second.body.pagination).toEqual({ page: 2, limit: 1, total: 2, totalPages: 2 });
    const beyond = await get('/staff/orders?status=PAID&limit=1&page=3').expect(200);
    expect(beyond.body.data).toEqual([]);
    expect(beyond.body.pagination.total).toBe(2);
    const all = await get('/staff/orders').expect(200);
    expect(all.body.pagination).toEqual({ page: 1, limit: 20, total: 3, totalPages: 1 });
  });

  it('INT-STAFF-06: returns an empty page when no orders match', async () => {
    await createOrder();
    const response = await get('/staff/orders?status=READY').expect(200);
    expect(response.body).toEqual({ data: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } });
  });

  it.each([
    'status=SHIPPED', 'status=', 'status=PAID&status=READY',
    'page=0', 'page=-1', 'page=1.5', 'page=abc', 'page=', 'page=1e2', 'page=1&page=2',
    'page=9007199254740992', 'page=2147483647&limit=100',
    'limit=0', 'limit=-1', 'limit=1.5', 'limit=101', 'limit=abc', 'limit=', 'limit=1&limit=2',
  ])('INT-STAFF-07: invalid query %s returns 400', async (query) => {
    await get(`/staff/orders?${query}`).expect(400);
  });

  it('INT-STAFF-08: includes item snapshots and payment progress without credentials or checkout keys', async () => {
    const product = await context.prisma.product.create({ data: {
      name: 'Tên sản phẩm hiện tại', description: '', imageUrl: '', price: 50000, stock: 2,
    } });
    const customer = await context.prisma.user.findUniqueOrThrow({ where: { email: 'customer@staff.example.test' } });
    const order = await context.prisma.order.create({ data: {
      status: 'PAID', userId: customer.id, customerName: customer.fullName, customerPhone: '0900000000',
      tableNumber: 5, notes: 'Không đường', totalAmount: 30000,
      items: { create: {
        productId: product.id, productName: 'Tên tại thời điểm đặt', unitPrice: 30000,
        quantity: 1, size: 'L', toppings: 'Trân châu', itemTotal: 30000,
      } },
      payment: { create: { amount: 30000, status: 'SUCCESS', idempotencyKey: 'private-checkout-key', paidAt: new Date() } },
    } });
    const detail = await get(`/staff/orders/${order.id}`).expect(200);
    expect(detail.body).toMatchObject({
      tableNumber: 5, notes: 'Không đường',
      items: [{ productName: 'Tên tại thời điểm đặt', unitPrice: 30000, quantity: 1, size: 'L', toppings: 'Trân châu' }],
      payment: { amount: 30000, status: 'SUCCESS' },
    });
    const list = await get('/staff/orders').expect(200);
    for (const entry of [detail.body, list.body.data[0]]) {
      expect(entry).not.toHaveProperty('user');
      expect(entry.payment).not.toHaveProperty('idempotencyKey');
      expect(entry.payment).not.toHaveProperty('transactionRef');
      expect(JSON.stringify(entry)).not.toContain(customer.password);
    }
  });

  it('INT-STAFF-09: missing orders return 404', async () => {
    await get('/staff/orders/not-found').expect(404);
    await patch('not-found', 'PREPARING').expect(404);
  });

  it.each([undefined, null, '', 'SHIPPED', 123, {}, ['READY']])
    ('INT-STAFF-10: malformed status (%#) cannot change an order', async (status) => {
      const order = await createOrder();
      await patch(order.id, status).expect(400);
      expect(await context.prisma.order.findUniqueOrThrow({ where: { id: order.id } })).toEqual(order);
    });

  it.each([OrderStatus.PENDING, OrderStatus.COMPLETED, OrderStatus.CANCELLED])
    ('INT-STAFF-11: forbidden transitions from %s preserve the entire stored order', async (status) => {
      const order = await createOrder(status);
      await patch(order.id, 'READY').expect(409);
      expect(await context.prisma.order.findUniqueOrThrow({ where: { id: order.id } })).toEqual(order);
    });

  it('INT-STAFF-12: concurrent preparation and cancellation cannot both succeed', async () => {
    const order = await createOrder();
    const responses = await Promise.all([patch(order.id, 'PREPARING'), patch(order.id, 'CANCELLED')]);
    expect(responses.map((response) => response.status).sort()).toEqual([200, 409]);
    const winner = responses.find((response) => response.status === 200);
    expect((await context.prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe(winner.body.status);
  });

  async function placeReservedOrder() {
    const product = await context.prisma.product.create({ data: {
      name: 'Cà phê', description: '', price: 30000, imageUrl: '', stock: 2,
    } });
    const placed = await request(context.app.getHttpServer()).post('/orders').send({
      customerName: 'Stock Test', customerPhone: '0900000000', items: [{
        productId: product.id, productName: product.name, unitPrice: 30000, quantity: 1, itemTotal: 30000,
      }],
    }).expect(201);
    return { product, order: placed.body };
  }

  it('INT-STAFF-13: cancellation returns reserved stock exactly once', async () => {
    const { product, order } = await placeReservedOrder();
    await patch(order.id, 'CANCELLED').expect(200);
    const restored = await context.prisma.product.findUniqueOrThrow({ where: { id: product.id } });
    expect(restored.stock).toBe(2);
    await patch(order.id, 'CANCELLED').expect(409);
    expect(await context.prisma.product.findUniqueOrThrow({ where: { id: product.id } })).toEqual(restored);
  });

  it.each(['/staff/orders', '/staff/orders/:id'])
    ('INT-STAFF-14: %s reflects expired reservations and restores stock', async (path) => {
      const { product, order } = await placeReservedOrder();
      await context.prisma.order.update({
        where: { id: order.id }, data: { reservationExpiresAt: new Date(Date.now() - 1000) },
      });
      const response = await get(path.replace(':id', order.id)).expect(200);
      const entry = path.endsWith(':id') ? response.body : response.body.data[0];
      expect(entry).toMatchObject({ status: 'CANCELLED', reservationStatus: 'RELEASED', reservationExpiresAt: null });
      expect((await context.prisma.product.findUniqueOrThrow({ where: { id: product.id } })).stock).toBe(2);
    });

  it('INT-STAFF-15: rejected customer updates leave state and stock unchanged on both routes', async () => {
    const { product, order } = await placeReservedOrder();
    const before = await context.prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    const stockBefore = await context.prisma.product.findUniqueOrThrow({ where: { id: product.id } });
    for (const path of [`/staff/orders/${order.id}/status`, `/orders/${order.id}/status`]) {
      await request(context.app.getHttpServer()).patch(path).auth(tokens.CUSTOMER, { type: 'bearer' })
        .send({ status: 'CANCELLED' }).expect(403);
    }
    expect(await context.prisma.order.findUniqueOrThrow({ where: { id: order.id } })).toEqual(before);
    expect(await context.prisma.product.findUniqueOrThrow({ where: { id: product.id } })).toEqual(stockBefore);
  });
});
