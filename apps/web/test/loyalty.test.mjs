import { beforeEach, afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const compiled = ts.transpileModule(readFileSync(new URL('../src/lib/loyalty.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
}).outputText;
const { requestLoyaltyAccount } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);

const entry = { id: 'entry-1', orderId: 'order-1', type: 'EARN', points: 34,
  description: 'Tích điểm đơn hàng', createdAt: '2026-11-15T00:00:00.000Z' };
const account = { loyaltyPoints: 1034, vndPerPoint: 1000, redemptionVndPerPoint: 100, transactions: [entry] };

describe('Loyalty API client', () => {
  const originalFetch = globalThis.fetch;
  let calls;
  beforeEach(() => {
    calls = [];
    globalThis.fetch = async (...args) => { calls.push(args); return Response.json(account); };
  });
  afterEach(() => { globalThis.fetch = originalFetch; });

  it('requests the authenticated current balance without cache or a client-selected user ID', async () => {
    const controller = new AbortController();
    assert.deepEqual(await requestLoyaltyAccount('http://localhost:3001/', 'customer-token', controller.signal), account);
    assert.equal(calls[0][0], 'http://localhost:3001/loyalty/me');
    assert.equal(calls[0][1].headers.Authorization, 'Bearer customer-token');
    assert.equal(calls[0][1].cache, 'no-store');
    assert.equal(calls[0][1].signal, controller.signal);
  });

  it('does not issue an anonymous balance request', async () => {
    await assert.rejects(requestLoyaltyAccount('http://localhost:3001', ''), /đăng nhập/);
    assert.equal(calls.length, 0);
  });

  it('shows an expired session as an error instead of inventing a zero balance', async () => {
    globalThis.fetch = async () => Response.json({}, { status: 401 });
    await assert.rejects(requestLoyaltyAccount('http://localhost:3001', 'expired-token'), /đăng nhập lại/);
  });

  it('preserves HTTP failures and network failures for the retry UI', async () => {
    globalThis.fetch = async () => new Response('', { status: 503 });
    await assert.rejects(requestLoyaltyAccount('http://localhost:3001', 'token'), /Không tải được/);
    globalThis.fetch = async () => { throw new TypeError('Network failure'); };
    await assert.rejects(requestLoyaltyAccount('http://localhost:3001', 'token'), /Network failure/);
  });

  for (const invalid of [
    null, { ...account, loyaltyPoints: -1 }, { ...account, loyaltyPoints: '1034' },
    { ...account, vndPerPoint: 0 }, { ...account, transactions: [{}] },
    { ...account, redemptionVndPerPoint: 0 },
    { ...account, transactions: [{ ...entry, points: 1.5 }] },
    { ...account, transactions: [{ ...entry, createdAt: 'invalid-date' }] },
  ]) {
    it(`refuses malformed loyalty data (${JSON.stringify(invalid)})`, async () => {
      globalThis.fetch = async () => Response.json(invalid);
      await assert.rejects(requestLoyaltyAccount('http://localhost:3001', 'token'), /không hợp lệ/);
    });
  }

  it('forwards aborts so responses from a previous account can be discarded', async () => {
    const controller = new AbortController();
    controller.abort();
    globalThis.fetch = async (_url, { signal }) => { signal.throwIfAborted(); };
    await assert.rejects(requestLoyaltyAccount('http://localhost:3001', 'token', controller.signal), { name: 'AbortError' });
  });

  it('gives a readable error for invalid JSON without exposing response text', async () => {
    globalThis.fetch = async () => new Response('<html>Unavailable</html>');
    await assert.rejects(requestLoyaltyAccount('http://localhost:3001', 'token'), /Dữ liệu điểm thưởng không hợp lệ/);
  });
});
