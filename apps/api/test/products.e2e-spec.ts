import request = require('supertest');
import { createTestApplication, TestApplication } from './helpers/test-app';

describe('Products API (E2E)', () => {
  let context: TestApplication;

  beforeAll(async () => {
    context = await createTestApplication();
  });

  beforeEach(async () => {
    await context.prisma.product.deleteMany();
  });

  afterAll(async () => {
    await context?.close();
  });

  const productData = {
    name: 'Latte E2E',
    description: 'Sản phẩm dùng cho kiểm thử E2E',
    price: 35000,
    imageUrl: 'https://example.com/latte.jpg',
    stock: 10,
  };

  it('E2E-PROD-01: GET /products returns available products sorted by name', async () => {
    const latte = await context.prisma.product.create({ data: productData });
    const americano = await context.prisma.product.create({
      data: { ...productData, name: 'Americano E2E', price: 29000 },
    });
    await context.prisma.product.create({
      data: { ...productData, name: 'Sold out E2E', stock: 0 },
    });

    const response = await request(context.app.getHttpServer())
      .get('/products')
      .expect('Content-Type', /json/)
      .expect(200);

    expect(response.body).toEqual({
      success: true,
      message: 'Lấy danh sách sản phẩm thành công',
      data: JSON.parse(JSON.stringify([americano, latte])),
    });
  });

  it('E2E-PROD-02: GET /products returns an empty list when there are no products', async () => {
    const response = await request(context.app.getHttpServer())
      .get('/products')
      .expect('Content-Type', /json/)
      .expect(200);

    expect(response.body).toEqual({
      success: true,
      message: 'Lấy danh sách sản phẩm thành công',
      data: [],
    });
  });

  it('E2E-PROD-05: GET /products/:id returns an existing product', async () => {
    const product = await context.prisma.product.create({ data: productData });

    const response = await request(context.app.getHttpServer())
      .get(`/products/${product.id}`)
      .expect('Content-Type', /json/)
      .expect(200);

    expect(response.body).toEqual({
      success: true,
      message: 'Lấy chi tiết sản phẩm thành công',
      data: JSON.parse(JSON.stringify(product)),
    });
  });

  it('E2E-PROD-06: GET /products/:id returns 404 for an unknown product', async () => {
    const id = 'missing-product-id';

    const response = await request(context.app.getHttpServer())
      .get(`/products/${id}`)
      .expect('Content-Type', /json/)
      .expect(404);

    expect(response.body).toEqual({
      statusCode: 404,
      message: `Product with ID ${id} was not found`,
      error: 'Not Found',
    });
  });
});
