import request = require('supertest');
import { AuthService } from '../src/auth/auth.service';
import { createTestApplication, TestApplication } from './helpers/test-app';

describe('Login and email matching (E2E)', () => {
  let context: TestApplication;
  const account = { fullName: 'Auth Regression', email: 'customer@example.test', password: 'Correct!123' };

  beforeAll(async () => { context = await createTestApplication(); });
  beforeEach(async () => { await context.prisma.user.deleteMany(); });
  afterAll(async () => { await context?.close(); });

  const register = (data = account) => request(context.app.getHttpServer()).post('/auth/register').send(data);
  const login = (email = account.email, password = account.password) =>
    request(context.app.getHttpServer()).post('/auth/login').send({ email, password });

  it('normalizes signup email and accepts a different casing at login', async () => {
    const registered = await register({ ...account, email: ' CUSTOMER@Example.Test ', fullName: ' Auth Regression ' }).expect(201);
    expect(registered.body.user.email).toBe(account.email);
    expect(registered.body.user.fullName).toBe(account.fullName);
    const response = await login(' Customer@EXAMPLE.TEST ').expect(201);
    expect(typeof response.body.accessToken).toBe('string');
    expect(response.body.user.id).toBe(registered.body.user.id);
    expect(response.body.user).not.toHaveProperty('password');
    const me = await request(context.app.getHttpServer()).get('/auth/me')
      .auth(response.body.accessToken, { type: 'bearer' }).expect(200);
    expect(me.body.userId).toBe(registered.body.user.id);
  });

  it('can log in to an existing account stored with a mixed-case email', async () => {
    const auth = context.app.get(AuthService);
    await context.prisma.user.create({ data: {
      email: 'Customer@Example.Test', fullName: account.fullName,
      password: auth.hashPassword(account.password),
    } });
    const response = await login().expect(201);
    expect(response.body.user.email).toBe('Customer@Example.Test');
  });

  it('rejects duplicate email even if its casing differs from an existing account', async () => {
    const auth = context.app.get(AuthService);
    await context.prisma.user.create({ data: {
      email: 'Customer@Example.Test', fullName: account.fullName,
      password: auth.hashPassword(account.password),
    } });
    await register().expect(409);
    expect(await context.prisma.user.count()).toBe(1);
  });

  it('returns 401 and no token for a wrong password or unknown email', async () => {
    await register().expect(201);
    for (const [email, password] of [[account.email, 'wrong-password'], ['unknown@example.test', account.password]]) {
      const response = await login(email, password).expect(401);
      expect(response.body.message).toBe('Email hoặc mật khẩu không chính xác');
      expect(response.body).not.toHaveProperty('accessToken');
    }
  });

  it('preserves intentional spaces in passwords', async () => {
    await register({ ...account, password: ' Password!123 ' }).expect(201);
    await login(account.email.toUpperCase(), ' Password!123 ').expect(201);
    await login(account.email, 'Password!123').expect(401);
  });

  it('returns 400 for malformed input instead of crashing', async () => {
    await request(context.app.getHttpServer()).post('/auth/login').send({ email: 123, password: 'secret' }).expect(400);
    await request(context.app.getHttpServer()).post('/auth/register').send({ ...account, fullName: ' ' }).expect(400);
  });
});
