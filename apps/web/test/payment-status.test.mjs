import { afterEach, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const code = ts.transpileModule(readFileSync(new URL('../src/lib/payment-status.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
}).outputText;
const { requestPaymentStatus } = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
const originalFetch = globalThis.fetch;
let calls;
beforeEach(() => {
  calls = [];
  globalThis.fetch = async (...args) => { calls.push(args); return Response.json({ orderId: 'order-1', status: 'PAID' }); };
});
afterEach(() => { globalThis.fetch = originalFetch; });

test('signed-in payment check requests authenticated server reconciliation without sending a success claim', async () => {
  const signal = new AbortController().signal;
  assert.equal(await requestPaymentStatus('https://api.example.test/', 'order-1', 'customer-token', signal), 'PAID');
  const [url, options] = calls[0];
  assert.equal(url, 'https://api.example.test/payments/sepay/sync');
  assert.equal(options.method, 'POST');
  assert.deepEqual(JSON.parse(options.body), { orderId: 'order-1' });
  assert.equal(options.headers.Authorization, 'Bearer customer-token');
  assert.equal(options.signal, signal);
  assert.equal(options.cache, 'no-store');
});

test('guest payment check only reads existing order status and encodes its ID', async () => {
  globalThis.fetch = async (...args) => { calls.push(args); return Response.json({ id: 'order /1', status: 'PENDING' }); };
  assert.equal(await requestPaymentStatus('https://api.example.test', 'order /1', null, new AbortController().signal), 'PENDING');
  assert.equal(calls[0][0], 'https://api.example.test/orders/order%20%2F1/status');
  assert.equal(calls[0][1].headers, undefined);
});

for (const body of [null, {}, { orderId: 'another-order', status: 'PAID' }, { orderId: 'order-1', status: 'CAPTURED' }]) {
  test(`invalid payment response cannot become success: ${JSON.stringify(body)}`, async () => {
    globalThis.fetch = async () => Response.json(body);
    await assert.rejects(requestPaymentStatus('https://api.example.test', 'order-1', 'token', new AbortController().signal), /hợp lệ/);
  });
}

test('payment HTTP and JSON errors are readable without exposing backend response content', async () => {
  globalThis.fetch = async () => new Response('private backend error', { status: 503 });
  await assert.rejects(requestPaymentStatus('https://api.example.test', 'order-1', 'token', new AbortController().signal), /Chưa thể xác nhận/);
  globalThis.fetch = async () => new Response('private backend response');
  await assert.rejects(requestPaymentStatus('https://api.example.test', 'order-1', 'token', new AbortController().signal), /hợp lệ/);
});
