import { afterEach, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import React from 'react';
import ts from 'typescript';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const originalWindow = globalThis.window;
const originalFetch = globalThis.fetch;
const user = { id: 'customer-1', email: 'customer@example.test', fullName: 'Customer' };
const token = (exp = Math.floor(Date.now() / 1000) + 3600) =>
  `header.${Buffer.from(JSON.stringify({ exp })).toString('base64url')}.signature`;
let values;
let clearedCart;

beforeEach(() => {
  values = new Map([['user', JSON.stringify(user)], ['cart', 'saved-cart']]);
  const session = new Map();
  const storage = (data) => ({
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value),
    removeItem: (key) => data.delete(key),
  });
  globalThis.window = { localStorage: storage(values), sessionStorage: storage(session), dispatchEvent() {} };
  clearedCart = false;
});

afterEach(() => {
  if (originalWindow === undefined) delete globalThis.window;
  else globalThis.window = originalWindow;
  globalThis.fetch = originalFetch;
});

// Execute the production component and auth helpers with controlled hooks and HTTP.
function checkout() {
  const states = [];
  let cursor = 0;
  const react = {
    useState(initial) {
      const index = cursor++;
      if (!(index in states)) states[index] = initial;
      return [states[index], (value) => { states[index] = value; }];
    },
    useRef(initial) {
      const index = cursor++;
      return states[index] ??= { current: initial };
    },
    useEffect() {},
  };
  const cart = { hydrated: true, itemCount: 1, subtotal: 30000,
    clearCart() { clearedCart = true; },
    removeItem(id) { cart.items = cart.items.filter((item) => item.id !== id); },
    items: [{ id: 'line-1', productId: 'product-1', productName: 'Coffee', basePrice: 30000,
      size: 'M', sizePriceAdjustment: 0, toppings: [], quantity: 1 }],
  };
  const loyalty = { userId: user.id, account: { loyaltyPoints: 46, vndPerPoint: 1000, redemptionVndPerPoint: 100, transactions: [] },
    loading: false, error: null, refresh() {} };
  const cache = new Map();
  function load(filename) {
    if (cache.has(filename)) return cache.get(filename).exports;
    const loadedModule = { exports: {} };
    cache.set(filename, loadedModule);
    const code = ts.transpileModule(readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020,
        jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
    }).outputText;
    const localRequire = (name) => {
      if (name === 'react') return react;
      if (name === 'next/link') return function Link(props) { return React.createElement('a', props); };
      if (name === '@/context/useCart') return { useCart: () => cart };
      if (name === '@/hooks/useLoyaltyAccount') return { useLoyaltyAccount: () => loyalty };
      if (name === './PromotionCodeField') return () => null;
      if (name.startsWith('@/') || name.startsWith('.')) {
        const base = name.startsWith('@/') ? resolve(root, 'src', name.slice(2)) : resolve(dirname(filename), name);
        return load([`${base}.ts`, `${base}.tsx`].find(existsSync));
      }
      return require(name);
    };
    new Function('require', 'module', 'exports', code)(localRequire, loadedModule, loadedModule.exports);
    return loadedModule.exports;
  }
  const Checkout = load(resolve(root, 'src/components/checkout/CheckoutPageClient.tsx')).default;
  const render = () => { cursor = 0; return Checkout(); };
  for (const [id, value] of [['customerName', 'Test Customer'], ['customerPhone', '0901234567']]) {
    find(render(), (node) => node.props.id === id).props.onChange({ target: { value } });
  }
  const redemption = () => {
    const field = find(render(), (node) => typeof node.props.onChange === 'function' && 'maxPoints' in node.props);
    return field.type(field.props);
  };
  return { cart, loyalty, render, redemption,
    usePoints: (points) => find(render(), (node) => typeof node.props.onChange === 'function' && 'maxPoints' in node.props).props.onChange(points),
    submit: () => find(render(), (node) => node.type === 'form').props.onSubmit({ preventDefault() {} }) };
}

function find(tree, predicate) {
  if (Array.isArray(tree)) return tree.map((node) => find(node, predicate)).find(Boolean);
  if (!tree || typeof tree !== 'object' || !tree.props) return undefined;
  return predicate(tree) ? tree : find(tree.props.children, predicate);
}

function assertSignInRequired(view) {
  assert.match(find(view, (node) => node.props.role === 'alert').props.children[0], /đăng nhập lại/);
  assert.ok(find(view, (node) => node.props.href === '/login'));
  assert.equal(find(view, (node) => node.props.id === 'customerName').props.value, 'Test Customer');
  assert.equal(values.has('token'), false);
  assert.equal(values.has('user'), false);
  assert.equal(values.get('cart'), 'saved-cart');
  assert.equal(clearedCart, false);
}

test('checkout sends selected points and retries the same request after points were debited', async () => {
  values.set('token', token());
  const view = checkout();
  view.usePoints(46);
  const requests = [];
  globalThis.fetch = async (url, options) => {
    if (url.endsWith('/orders')) {
      requests.push(options);
      return Response.json({ id: 'redeemed-order', status: 'PENDING', totalAmount: 25400, redeemedPoints: 46, loyaltyDiscountAmount: 4600 });
    }
    return new Response('', { status: 503 });
  };
  await view.submit();
  view.loyalty.account.loyaltyPoints = 0;
  assert.equal(find(view.render(), (node) => node.type === 'button' && node.props.type === 'submit').props.disabled, false);
  await view.submit();
  assert.equal(requests.length, 2);
  assert.equal(JSON.parse(requests[0].body).redeemedPoints, 46);
  assert.equal(requests[0].body, requests[1].body);
  assert.equal(requests[0].headers['Idempotency-Key'], requests[1].headers['Idempotency-Key']);
  assert.equal(clearedCart, false);
});

test('accepted maximum points do not become an over-limit warning after the balance refreshes', async () => {
  values.set('token', token());
  const view = checkout();
  find(view.redemption(), (node) => node.type === 'button' && node.props.children === 'Dùng tối đa').props.onClick();
  globalThis.fetch = async (url) => url.endsWith('/orders')
    ? Response.json({ id: 'redeemed-order', status: 'PENDING', totalAmount: 25400, redeemedPoints: 46, loyaltyDiscountAmount: 4600 })
    : new Response('', { status: 503 });
  await view.submit();
  view.loyalty.account.loyaltyPoints = 0;
  assert.equal(find(view.redemption(), (node) => node.props.role === 'alert'), undefined);
  assert.equal(find(view.redemption(), (node) => node.type === 'strong').props.children.join(''), '46 điểm');
  assert.equal(find(view.render(), (node) => node.props.type === 'submit').props.disabled, false);
  view.loyalty.account = null;
  assert.equal(find(view.redemption(), (node) => node.props.role === 'alert'), undefined);
  assert.ok(find(view.redemption(), (node) => node.props.role === 'status'));
});

test('editing an accepted order does not reuse its point allowance for a new request', async () => {
  values.set('token', token());
  const view = checkout();
  view.usePoints(46);
  globalThis.fetch = async (url) => url.endsWith('/orders')
    ? Response.json({ id: 'redeemed-order', status: 'PENDING', totalAmount: 25400, redeemedPoints: 46, loyaltyDiscountAmount: 4600 })
    : new Response('', { status: 503 });
  await view.submit();
  view.loyalty.account.loyaltyPoints = 0;
  find(view.render(), (node) => node.props.id === 'customerName').props.onChange({ target: { value: 'Changed customer' } });
  assert.ok(find(view.redemption(), (node) => node.props.role === 'alert'));
  assert.equal(find(view.render(), (node) => node.props.type === 'submit').props.disabled, true);
});

test('checkout rejects a new request with more points than the balance or payable total', async () => {
  values.set('token', token());
  const view = checkout();
  view.usePoints(47);
  assert.equal(find(view.render(), (node) => node.type === 'button' && node.props.type === 'submit').props.disabled, true);
  let requests = 0;
  globalThis.fetch = async () => { requests++; throw new Error('Unexpected request'); };
  await view.submit();
  assert.equal(requests, 0);
  assert.match(find(view.render(), (node) => node.props.role === 'alert').props.children[0], /Số điểm sử dụng vượt/);
});

test('a fully redeemed order completes without a SePay request and clears the cart only after server confirmation', async () => {
  values.set('token', token());
  const view = checkout();
  view.loyalty.account.loyaltyPoints = 300;
  view.usePoints(300);
  let requests = 0;
  globalThis.fetch = async (url) => {
    requests++;
    assert.ok(url.endsWith('/orders'));
    return Response.json({ id: 'points-only-order', status: 'PAID', totalAmount: 0, redeemedPoints: 300, loyaltyDiscountAmount: 30000 });
  };
  assert.equal(clearedCart, false);
  await view.submit();
  assert.equal(requests, 1);
  assert.equal(clearedCart, true);
  assert.ok(find(view.render(), (node) => node.type === 'h1').props.children.includes('thành công'));
});

test('checkout rejects missing, malformed and expired tokens before any order request', async () => {
  for (const stale of [null, 'bad-token', token(1)]) {
    if (stale) values.set('token', stale);
    let calls = 0;
    globalThis.fetch = async () => { calls++; throw new Error('Unexpected request'); };
    const host = checkout();
    await host.submit();
    assert.equal(calls, 0);
    assertSignInRequired(host.render());
  }
});

for (const stage of ['order', 'payment']) {
  test(`checkout clears a session rejected by the ${stage} API without retrying or clearing the cart`, async () => {
    const current = token();
    values.set('token', current);
    const calls = [];
    globalThis.fetch = async (url, options) => {
      calls.push(url);
      assert.equal(options.headers.Authorization, `Bearer ${current}`);
      assert.ok(options.headers['Idempotency-Key']);
      if (stage === 'payment' && calls.length === 1) return Response.json({ id: 'order-1' }, { status: 201 });
      return new Response('Unauthorized', { status: 401 });
    };
    const host = checkout();
    await host.submit();
    assert.equal(calls.length, stage === 'order' ? 1 : 2);
    assertSignInRequired(host.render());
  });
}

test('a server failure preserves a valid session and allows retry without asking for sign-in', async () => {
  const current = token();
  values.set('token', current);
  globalThis.fetch = async () => Response.json({ message: 'Temporary failure' }, { status: 500 });
  const host = checkout();
  await host.submit();
  const view = host.render();
  assert.equal(find(view, (node) => node.props.role === 'alert').props.children[0], 'Temporary failure');
  assert.equal(find(view, (node) => node.props.href === '/login'), undefined);
  assert.equal(values.get('token'), current);
  assert.equal(values.get('user'), JSON.stringify(user));
  assert.equal(clearedCart, false);
});

const availableProduct = { id: 'product-1', name: 'Coffee', description: 'Coffee',
  imageUrl: '/coffee.svg', price: 30000, stock: 10 };

test('a stale numeric product ID can be removed without changing valid items or automatically retrying', async () => {
  const current = token();
  values.set('token', current);
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push(url);
    if (url.endsWith('/orders')) {
      const payload = JSON.parse(options.body);
      assert.deepEqual(payload.items.map((item) => item.productId), ['1', 'product-1']);
      return Response.json({ message: 'Product with ID 1 was not found' }, { status: 404 });
    }
    assert.ok(url.endsWith('/products'));
    assert.equal(options.cache, 'no-store');
    return Response.json({ success: true, data: [availableProduct] });
  };
  const host = checkout();
  const valid = host.cart.items[0];
  host.cart.items = [{ ...valid, id: 'legacy-line', productId: '1' }, valid];
  await host.submit();
  let view = host.render();
  assert.match(find(view, (node) => node.props.role === 'alert').props.children[0], /không còn trong thực đơn/);
  assert.equal(host.cart.items.length, 2);
  assert.equal(calls.length, 2);
  assert.equal(find(view, (node) => node.props.type === 'submit').props.disabled, true);
  find(view, (node) => node.type === 'button' && node.props.children === 'Xóa món không còn trong thực đơn').props.onClick();
  view = host.render();
  assert.deepEqual(host.cart.items, [valid]);
  assert.equal(clearedCart, false);
  assert.equal(values.get('token'), current);
  assert.equal(find(view, (node) => node.props.type === 'submit').props.disabled, false);
  assert.equal(find(view, (node) => node.props.role === 'alert'), undefined);
});

for (const failure of ['offline', 'invalid catalog']) {
  test(`a missing product with an ${failure} catalog preserves all cart items and offers recovery links`, async () => {
    values.set('token', token());
    globalThis.fetch = async (url) => {
      if (url.endsWith('/orders')) return Response.json({}, { status: 404 });
      if (failure === 'offline') throw new TypeError('Offline');
      return Response.json({ success: true, data: [{}] });
    };
    const host = checkout();
    const original = [...host.cart.items];
    await host.submit();
    const view = host.render();
    assert.deepEqual(host.cart.items, original);
    assert.equal(clearedCart, false);
    assert.ok(find(view, (node) => node.props.href === '/cart'));
    assert.ok(find(view, (node) => node.props.href === '/menu'));
    assert.equal(find(view, (node) => node.type === 'button' && node.props.children === 'Xóa món không còn trong thực đơn'), undefined);
  });
}
