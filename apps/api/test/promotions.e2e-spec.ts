import request = require('supertest');
import { DiscountType, Product } from '@prisma/client';
import { createTestApplication, TestApplication } from './helpers/test-app';

describe('Apply valid promotion (HTTP + PostgreSQL integration)', () => {
  let context: TestApplication;
  let product: Product;

  beforeAll(async () => {
    context = await createTestApplication();
    await context.app.listen(0, '127.0.0.1');
  });
  beforeEach(async () => {
    await context.prisma.order.deleteMany();
    await context.prisma.promotion.deleteMany();
    await context.prisma.product.deleteMany();
    product = await context.prisma.product.create({ data: {
      name: 'Cà phê sữa', description: '', imageUrl: '', price: 30000, stock: 10,
    } });
    await context.prisma.promotion.create({ data: {
      code: 'BREW10', discountType: 'PERCENTAGE', discountValue: 10, minOrderValue: 50000,
      validFrom: new Date('2020-01-01T00:00:00Z'),
    } });
  });
  afterAll(async () => { await context?.close(); });

  const validate = (code: unknown = 'BREW10', subtotalAmount: unknown = 60000) =>
    request(context.app.getHttpServer()).post('/promotions/validate').send({ code, subtotalAmount });
  const payload = () => ({
    customerName: 'Promotion Customer', customerPhone: '0900000000', promotionCode: 'BREW10',
    items: [{ productId: product.id, quantity: 2 }],
  });
  const place = (data: object = payload()) => request(context.app.getHttpServer()).post('/orders').send(data);
  const storedProduct = () => context.prisma.product.findUniqueOrThrow({ where: { id: product.id } });
  const updatePromotion = (data: Parameters<typeof context.prisma.promotion.update>[0]['data']) =>
    context.prisma.promotion.update({ where: { code: 'BREW10' }, data });

  it('INT-PROMO-01: previews a code without changing orders or inventory; accepts casing and whitespace', async () => {
    await updatePromotion({ code: 'Brew10' });
    const response = await validate('  bREw10  ').expect(200);
    expect(response.body).toMatchObject({
      valid: true, code: 'Brew10', subtotalAmount: 60000, discountAmount: 6000, totalAmount: 54000,
    });
    expect(await context.prisma.order.count()).toBe(0);
    expect(await storedProduct()).toEqual(product);
  });

  it('INT-PROMO-02: saves the discount and authoritative item prices atomically', async () => {
    const response = await place({ ...payload(), promotionCode: '  brew10 ',
      subtotalAmount: 999999, discountAmount: 999999, totalAmount: 1,
      items: [{ productId: product.id, quantity: 2, productName: 'Forged name', unitPrice: 1, itemTotal: 999999 }],
    }).expect(201);
    expect(response.body).toMatchObject({
      subtotalAmount: 60000, discountAmount: 6000, totalAmount: 54000, promotionCode: 'BREW10',
      reservationStatus: 'HELD', items: [{ productName: product.name, unitPrice: 30000, itemTotal: 60000 }],
    });
    const promotion = await context.prisma.promotion.findUniqueOrThrow({ where: { code: 'BREW10' } });
    const saved = await context.prisma.order.findUniqueOrThrow({ where: { id: response.body.id } });
    expect(saved).toMatchObject({ promotionId: promotion.id, promotionCode: 'BREW10', discountAmount: 6000, totalAmount: 54000 });
    expect((await storedProduct()).stock).toBe(8);
    const status = await request(context.app.getHttpServer()).get(`/orders/${saved.id}/status`).expect(200);
    expect(status.body).toMatchObject({ subtotalAmount: 60000, discountAmount: 6000, totalAmount: 54000, promotionCode: 'BREW10' });
  });

  it.each([
    [{ discountValue: 50, maxDiscount: 5000 }, 5000],
    [{ discountType: DiscountType.FIXED_AMOUNT, discountValue: 15000 }, 15000],
    [{ discountType: DiscountType.FIXED_AMOUNT, discountValue: 100000 }, 60000],
    [{ discountType: DiscountType.FIXED_AMOUNT, discountValue: 10000, maxDiscount: 2000 }, 2000],
    [{ discountValue: 100 }, 60000],
  ])('INT-PROMO-03: applies configured discount %#', async (data, discountAmount) => {
    await updatePromotion(data);
    const response = await place().expect(201);
    expect(response.body).toMatchObject({ subtotalAmount: 60000, discountAmount, totalAmount: 60000 - discountAmount });
  });

  it.each([
    { isActive: false },
    { validFrom: new Date('2100-01-01T00:00:00Z') },
    { validTo: new Date('2020-01-02T00:00:00Z') },
    { minOrderValue: 60001 },
    { discountValue: 0 },
    { discountValue: -1 },
    { discountValue: 101 },
    { minOrderValue: -1 },
    { maxDiscount: 0 },
    { maxDiscount: -1 },
  ])('INT-PROMO-04: invalid promotion configuration/conditions (%#) cannot create or reserve an order', async (data) => {
    await updatePromotion(data);
    await validate().expect(400);
    await place().expect(400);
    expect(await context.prisma.order.count()).toBe(0);
    expect(await storedProduct()).toEqual(product);
  });

  it('INT-PROMO-05: an unknown code is rejected without changing stock', async () => {
    await validate('MISSING').expect(400);
    await place({ ...payload(), promotionCode: 'MISSING' }).expect(400);
    expect(await context.prisma.order.count()).toBe(0);
    expect(await storedProduct()).toEqual(product);
  });

  it.each([null, '', ' ', 123, {}, []])('INT-PROMO-06: malformed promotion code (%#) is rejected', async (promotionCode) => {
    await validate(promotionCode).expect(400);
    await place({ ...payload(), promotionCode }).expect(400);
    expect(await context.prisma.order.count()).toBe(0);
    expect(await storedProduct()).toEqual(product);
  });

  it.each([null, -1, 1.5, '60000', 2147483648])('INT-PROMO-07: malformed preview subtotal (%#) returns 400', async (amount) => {
    await validate('BREW10', amount).expect(400);
  });

  it('INT-PROMO-08: checks validity again when an accepted preview is disabled before order creation', async () => {
    await validate().expect(200);
    await updatePromotion({ isActive: false });
    await place().expect(400);
    expect(await context.prisma.order.count()).toBe(0);
    expect(await storedProduct()).toEqual(product);
  });

  it('INT-PROMO-09: a forged subtotal cannot satisfy the minimum spend', async () => {
    await validate('BREW10', 60000).expect(200);
    await place({ ...payload(), subtotalAmount: 60000,
      items: [{ productId: product.id, quantity: 1, unitPrice: 60000, itemTotal: 60000 }],
    }).expect(400);
    expect(await context.prisma.order.count()).toBe(0);
    expect(await storedProduct()).toEqual(product);
  });

  it('INT-PROMO-10: prices sizes and topping quantities before calculating the discount', async () => {
    const response = await place({ ...payload(), items: [{
      productId: product.id, quantity: 2, size: 'L', toppings: 'Trân châu đen x2, Thạch đào',
      unitPrice: 1, itemTotal: 2,
    }] }).expect(201);
    expect(response.body).toMatchObject({ subtotalAmount: 114000, discountAmount: 11400, totalAmount: 102600,
      items: [{ unitPrice: 57000, itemTotal: 114000, size: 'L', toppings: 'Trân châu đen x2, Thạch đào' }],
    });
  });

  it.each([
    { size: 'XL' }, { size: null }, { toppings: 'Unknown topping' }, { toppings: ['Trân châu đen'] },
    { toppings: 'Trân châu đen x0' }, { toppings: 'Thạch đào x6' }, { toppings: 'Thạch đào x3, Thạch đào x3' },
  ])('INT-PROMO-11: invalid size/toppings (%#) cannot alter inventory', async (options) => {
    await place({ ...payload(), items: [{ productId: product.id, quantity: 2, ...options }] }).expect(400);
    expect(await storedProduct()).toEqual(product);
    expect(await context.prisma.order.count()).toBe(0);
  });

  it('INT-PROMO-12: orders without a code retain the normal pricing flow', async () => {
    const data = payload();
    delete data.promotionCode;
    const response = await place(data).expect(201);
    expect(response.body).toMatchObject({ subtotalAmount: 60000, discountAmount: 0, totalAmount: 60000,
      promotionId: null, promotionCode: null,
    });
  });

  it('INT-PROMO-13: payment checkout and callbacks must match the saved discounted amount', async () => {
    const placed = await place().expect(201);
    const orderId = placed.body.id;
    const checkout = (amount: unknown) => request(context.app.getHttpServer()).post('/payments/sepay/checkout')
      .send({ orderId, amount, idempotencyKey: `promo-${orderId}` });
    for (const amount of [60000, 1, '54000', -1]) await checkout(amount).expect(400);
    expect(await context.prisma.payment.count()).toBe(0);
    const payment = await checkout(54000).expect(201);
    expect(payment.body.amount).toBe(54000);
    expect(new URL(payment.body.qrUrl).searchParams.get('amount')).toBe('54000');
    for (const amount of [60000, 1, '54000']) {
      await request(context.app.getHttpServer()).post('/payments/sepay/webhook-ipn')
        .send({ orderId, amount, status: 'SUCCESS', transactionRef: `promo-txn-${orderId}` }).expect(400);
      expect((await context.prisma.order.findUniqueOrThrow({ where: { id: orderId } })).status).toBe('PENDING');
    }
    await request(context.app.getHttpServer()).post('/payments/sepay/webhook-ipn')
      .send({ orderId, amount: 54000, status: 'SUCCESS', transactionRef: `promo-txn-${orderId}` }).expect(201);
    expect((await context.prisma.order.findUniqueOrThrow({ where: { id: orderId } })).status).toBe('PAID');
  });

  it('INT-PROMO-14: later edits or deletion of the promotion do not change the order discount snapshot', async () => {
    const placed = await place().expect(201);
    await updatePromotion({ code: 'RENAMED', discountValue: 50, isActive: false });
    await context.prisma.promotion.delete({ where: { code: 'RENAMED' } });
    const order = await context.prisma.order.findUniqueOrThrow({ where: { id: placed.body.id } });
    expect(order).toMatchObject({ subtotalAmount: 60000, discountAmount: 6000, totalAmount: 54000,
      promotionCode: 'BREW10', promotionId: null,
    });
  });
});
