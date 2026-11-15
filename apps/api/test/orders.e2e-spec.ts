import request = require('supertest');
import { Role } from '@prisma/client';
import { AuthService } from '../src/auth/auth.service';
import { createTestApplication, TestApplication } from './helpers/test-app';

describe('Orders & Checkout Flow (E2E)', () => {
  let context: TestApplication;
  let customerToken: string;

  beforeAll(async () => {
    process.env.SEPAY_IPN_SECRET_KEY ||= 'brewlite-e2e-local-secret';
    context = await createTestApplication();
    const customer = await context.prisma.user.create({
      data: {
        email: 'orders-customer@example.test',
        password: 'unused-e2e-test-password',
        fullName: 'Orders Customer',
        role: Role.CUSTOMER,
      },
    });
    customerToken = context.app.get(AuthService).generateToken({
      userId: customer.id, email: customer.email,
      role: customer.role, fullName: customer.fullName,
    });
  });

  beforeEach(async () => {
    if (context?.prisma?.payment) await context.prisma.payment.deleteMany();
    if (context?.prisma?.orderItem) await context.prisma.orderItem.deleteMany();
    if (context?.prisma?.order) await context.prisma.order.deleteMany();
    if (context?.prisma?.product) await context.prisma.product.deleteMany();
  });

  afterAll(async () => {
    await context?.close();
  });

  it('E2E-ORD-01: End-to-end checkout flow from placing order to SePay IPN confirmation', async () => {
    // 1. Setup product
    const product = await context.prisma.product.create({
      data: {
        name: 'Trà Đào Cam Sả',
        description: 'Thức uống thanh mát',
        price: 39000,
        imageUrl: 'https://example.com/tra-dao.jpg',
        stock: 50,
      },
    });

    // 2. Place Order (POST /orders)
    const orderPayload = {
      customerName: 'Nguyễn Tuấn Kiệt',
      customerPhone: '0901234567',
      tableNumber: 5,
      notes: 'Ít đường, nhiều đá',
      items: [
        {
          productId: product.id,
          productName: product.name,
          unitPrice: product.price,
          quantity: 2,
          size: 'L',
          itemTotal: 78000,
        },
      ],
    };

    const orderRes = await request(context.app.getHttpServer())
      .post('/orders')
      .auth(customerToken, { type: 'bearer' })
      .send(orderPayload)
      .expect(201);

    expect(orderRes.body.id).toBeDefined();
    expect(orderRes.body.status).toEqual('PENDING');
    // L adds 5,000 VND per drink; the server ignores the stale client price.
    expect(orderRes.body.totalAmount).toEqual(88000);
    const orderId = orderRes.body.id;

    // 3. Initiate Checkout QR (POST /payments/sepay/checkout)
    const checkoutRes = await request(context.app.getHttpServer())
      .post('/payments/sepay/checkout')
      .send({
        orderId,
        amount: 88000,
        idempotencyKey: `idem-${orderId}`,
      })
      .expect(201);

    expect(checkoutRes.body.qrUrl).toBeDefined();
    expect(checkoutRes.body.status).toEqual('PENDING');

    // 4. Simulate SePay Webhook IPN (POST /payments/sepay/webhook-ipn)
    const webhookRes = await request(context.app.getHttpServer())
      .post('/payments/sepay/webhook-ipn')
      .set('x-secret-key', process.env.SEPAY_IPN_SECRET_KEY!)
      .send({
      timestamp: Date.now(),
      notification_type: 'ORDER_PAID',
      order: {
        order_invoice_number: orderId,
        order_status: 'CAPTURED',
        order_amount: String(88000),
        order_currency: 'VND',
      },
      transaction: {
        transaction_id: 'SEPAY_TEST_TXN_999',
        transaction_type: 'PAYMENT',
        transaction_status: 'APPROVED',
        transaction_amount: String(88000),
        transaction_currency: 'VND',
      },
    })
      .expect(201);

    expect(webhookRes.body).toMatchObject({ success: true });
    expect((await context.prisma.payment.findUniqueOrThrow({ where: { orderId } })).status).toBe('SUCCESS');

    // 5. Verify Order Status transitioned to PAID (GET /orders/:id/status)
    const statusRes = await request(context.app.getHttpServer())
      .get(`/orders/${orderId}/status`)
      .expect(200);

    expect(statusRes.body.status).toEqual('PAID');
  });
});

