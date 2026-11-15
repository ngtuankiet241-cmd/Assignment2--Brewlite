import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const customer = { id: 'customer-a', fullName: 'Khách hàng', email: 'customer@example.test' };
const account = (points) => ({ loyaltyPoints: points, vndPerPoint: 1000, redemptionVndPerPoint: 100, transactions: [] });
const tick = () => new Promise((done) => setImmediate(done));
function find(tree, predicate) {
  if (Array.isArray(tree)) return tree.map((node) => find(node, predicate)).find(Boolean);
  if (!tree || typeof tree !== 'object' || !tree.props) return undefined;
  return predicate(tree) ? tree : find(tree.props.children, predicate);
}

// Execute the production hook/components with controlled effects and HTTP.
function host(component = 'hooks/useLoyaltyAccount', options = {}) {
  const context = { user: customer, orderId: 'order-1', fetch: async () => Response.json(account(46)), ...options };
  const slots = [], pending = [], timers = new Map(), intervals = new Map();
  const browser = new EventTarget();
  let cursor = 0, nextTimer = 0, tree;
  browser.localStorage = { setItem() {} };
  browser.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
  browser.setTimeout = (callback) => { timers.set(++nextTimer, callback); return nextTimer; };
  browser.clearTimeout = (id) => timers.delete(id);
  browser.setInterval = (callback) => { intervals.set(++nextTimer, callback); return nextTimer; };
  browser.clearInterval = (id) => intervals.delete(id);
  const hooks = {
    useState(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial;
      return [slots[index], (value) => { slots[index] = typeof value === 'function' ? value(slots[index]) : value; }];
    },
    useEffect(callback, dependencies) {
      const index = cursor++, previous = slots[index];
      if (!previous || dependencies.some((value, i) => value !== previous.dependencies[i])) pending.push(() => {
        previous?.cleanup?.(); slots[index] = { dependencies, cleanup: callback() };
      });
    },
    useRef: (initial) => ({ current: initial }), useId: () => 'test-navigation',
  };
  const cache = new Map();
  function load(filename) {
    if (cache.has(filename)) return cache.get(filename).exports;
    const loaded = { exports: {} }; cache.set(filename, loaded);
    const code = ts.transpileModule(readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
    }).outputText;
    const localRequire = (name) => {
      if (name === 'react') return hooks;
      if (name === '@/hooks/useAuth') return { useAuth: () => ({ user: context.user, logout() {} }) };
      if (name === '@/lib/auth') return { getAuthToken: () => context.user ? `token-${context.user.id}` : null };
      if (name === '@/context/useCart') return { useCart: () => ({ itemCount: 2, hydrated: false }) };
      if (name === 'next/navigation') return { usePathname: () => '/', useRouter: () => ({ replace() {} }),
        useSearchParams: () => new URLSearchParams(context.orderId ? { orderId: context.orderId } : {}) };
      if (name.startsWith('@/') || name.startsWith('.')) {
        const base = name.startsWith('@/') ? resolve(root, 'src', name.slice(2)) : resolve(dirname(filename), name);
        const dependency = [base, `${base}.ts`, `${base}.tsx`].find(existsSync);
        if (dependency) return load(dependency);
      }
      return require(name);
    };
    new Function('require', 'module', 'exports', 'window', 'fetch', code)(localRequire, loaded, loaded.exports, browser, (...args) => context.fetch(...args));
    return loaded.exports;
  }
  const isHook = component.startsWith('hooks/');
  const loaded = load(resolve(root, `src/${isHook ? component : `components/${component}`}.${isHook ? 'ts' : 'tsx'}`));
  const run = isHook ? loaded.useLoyaltyAccount : loaded.default;
  return {
    context, browser, timers, intervals,
    render() {
      cursor = 0;
      tree = run(isHook ? 'https://api.example.test' : {});
      for (const effect of pending.splice(0)) effect();
      return isHook ? tree : tree ? renderToStaticMarkup(tree) : '';
    },
    clickButton() { find(tree, (node) => node.type === 'button').props.onClick(); },
    fireTimers() { const callbacks = [...timers.values()]; timers.clear(); for (const callback of callbacks) callback(); },
    dispose() { for (const slot of slots) slot?.cleanup?.(); },
  };
}

test('guests do not request a balance or see invented points', () => {
  const view = host(undefined, { user: null, fetch() { assert.fail('Guest requested points'); } });
  assert.equal(view.render().account, null);
  assert.equal(view.render().loading, false);
  view.dispose();
});

test('balance hook loads actual points, supports retry and responds to checkout updates', async () => {
  const view = host(undefined, { fetch: async () => new Response('', { status: 503 }) });
  assert.equal(view.render().loading, true); await tick();
  assert.match(view.render().error, /Không tải được/);
  view.context.fetch = async () => Response.json(account(46));
  view.render().refresh(); view.render(); await tick();
  assert.equal(view.render().account.loyaltyPoints, 46);
  view.context.fetch = async () => Response.json(account(0));
  view.browser.dispatchEvent(new Event('brewlite:loyalty-changed'));
  view.render(); await tick();
  assert.equal(view.render().account.loyaltyPoints, 0);
  view.dispose(); assert.equal(view.timers.size, 0); assert.equal(view.intervals.size, 0);
});

test('account switch immediately hides old points and ignores late responses', async () => {
  let respond, signal;
  const view = host(undefined, { fetch: (_url, options) => { signal = options.signal; return new Promise((done) => { respond = done; }); } });
  view.render();
  view.context.user = { ...customer, id: 'customer-b' };
  view.context.fetch = async () => Response.json(account(12));
  assert.equal(view.render().account, null); assert.equal(signal.aborted, true); await tick();
  assert.equal(view.render().account.loyaltyPoints, 12);
  respond(Response.json(account(9999))); await tick();
  assert.equal(view.render().account.loyaltyPoints, 12);
  view.context.user = null;
  assert.equal(view.render().account, null); view.dispose();
});

test('slow balance lookup times out and ignores a late success', async () => {
  let respond;
  const view = host(undefined, { fetch: () => new Promise((done) => { respond = done; }) });
  view.render(); view.fireTimers();
  assert.match(view.render().error, /quá lâu/);
  respond(Response.json(account(9999))); await tick();
  assert.equal(view.render().account, null); view.dispose();
});

test('home header displays points beside desktop/mobile carts without a loyalty-page link', async () => {
  const view = host('layout/Header');
  view.render(); await tick();
  const html = view.render();
  assert.equal((html.match(/Điểm thưởng hiện có: 46 điểm/g) ?? []).length, 4);
  assert.match(html, /Giỏ hàng, 2 sản phẩm/);
  assert.doesNotMatch(html, /href="\/loyalty"/);
  view.context.user = null;
  assert.doesNotMatch(view.render(), /46 điểm/); view.dispose();
});

test('payment polling continues beyond one minute, confirms from the API and stops', async () => {
  let requests = 0;
  const view = host('payment/PaymentResultClient', { fetch: async () => Response.json({ orderId: 'order-1', status: ++requests > 15 ? 'PAID' : 'PENDING' }) });
  view.render(); await tick();
  for (let i = 0; i < 15; i++) { assert.doesNotMatch(view.render(), /<h1[^>]*>Thanh toán thành công/); view.fireTimers(); await tick(); }
  assert.match(view.render(), /<h1[^>]*>Thanh toán thành công/);
  assert.equal(requests, 16); assert.equal(view.timers.size, 0); view.dispose();
});

test('payment retry recovers from errors and cannot trust a late reply for another order', async () => {
  const view = host('payment/PaymentResultClient', { fetch: async () => new Response('', { status: 503 }) });
  view.render(); await tick(); assert.match(view.render(), /Kiểm tra lại thanh toán/);
  view.context.fetch = async () => Response.json({ orderId: 'order-1', status: 'PAID' });
  view.clickButton(); view.render(); await tick(); assert.match(view.render(), /<h1[^>]*>Thanh toán thành công/); view.dispose();
  let respond, signal;
  const switched = host('payment/PaymentResultClient', { fetch: (_url, options) => { signal = options.signal; return new Promise((done) => { respond = done; }); } });
  switched.render(); switched.context.orderId = 'order-2';
  switched.context.fetch = async () => Response.json({ orderId: 'order-2', status: 'PENDING' });
  switched.render(); assert.equal(signal.aborted, true); await tick();
  respond(Response.json({ orderId: 'order-1', status: 'PAID' })); await tick();
  assert.doesNotMatch(switched.render(), /<h1[^>]*>Thanh toán thành công/); switched.dispose(); assert.equal(switched.timers.size, 0);
});
