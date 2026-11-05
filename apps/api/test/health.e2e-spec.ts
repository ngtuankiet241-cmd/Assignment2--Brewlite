import request = require('supertest');
import { createTestApplication, TestApplication } from './helpers/test-app';

describe('Health API (E2E)', () => {
  let context: TestApplication;

  beforeAll(async () => {
    context = await createTestApplication();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  afterAll(async () => {
    await context?.close();
  });

  it('E2E-HEALTH-01: GET /health returns 200 when the database is reachable', async () => {
    const response = await request(context.app.getHttpServer())
      .get('/health')
      .expect('Content-Type', /json/)
      .expect(200);

    expect(response.body).toEqual({ status: 'ok', database: 'up' });
  });

  it('E2E-HEALTH-02: GET /health returns 503 when the database connection fails', async () => {
    // Simulate a failed DB query without stopping the shared PostgreSQL server.
    jest.spyOn(context.prisma, '$queryRaw').mockRejectedValueOnce(
      new Error('Database connection lost'),
    );

    const response = await request(context.app.getHttpServer())
      .get('/health')
      .expect('Content-Type', /json/)
      .expect(503);

    expect(response.body).toEqual({ status: 'error', database: 'down' });
  });
});
