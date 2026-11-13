import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const require = createRequire(import.meta.url);
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const tick = () => new Promise((done) => setImmediate(done));

function loader(mocks = {}, fetcher = () => { throw new Error('Staff demo must not call any real API'); }) {
  const cache = new Map();
  function load(path) {
    const filename = resolve(root, path);
    if (cache.has(filename)) return cache.get(filename).exports;
    const loaded = { exports: {} }; cache.set(filename, loaded);
    const code = ts.transpileModule(readFileSync(filename, 'utf8'), {
      compilerOptions: { target: ts.ScriptTarget.ES2017, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
    }).outputText;
    function localRequire(name) {
      if (name in mocks) return mocks[name];
      if (name === 'next/link') return { __esModule: true, default: ({ children, ...props }) => React.createElement('a', props, children) };
      if (name.startsWith('@/') || name.startsWith('.')) {
        const base = name.startsWith('@/') ? resolve(root, 'src', name.slice(2)) : resolve(dirname(filename), name);
        const file = [base, `${base}.ts`, `${base}.tsx`].find(existsSync);
        if (file) return load(file);
      }
      return require(name);
    }
    new Function('require', 'module', 'exports', 'fetch', code)(localRequire, loaded, loaded.exports, fetcher);
    return loaded.exports;
  }
  return load;
}

const load = loader();
const { STAFF_DEMO_ORDERS, loadStaffDemoOrders } = load('src/data/staffDemoOrders.ts');
const { canAccessStaff, filterStaffOrders, selectStaffOrder, getStaffSummary, STAFF_NEXT_ACTION, STAFF_STATUSES } = load('src/types/staff.ts');
const render = (component, props) => renderToStaticMarkup(React.createElement(component, props));

test('staff permissions allow only BARISTA and ADMIN; customer and unknown roles are denied', () => {
  for (const role of ['BARISTA', 'ADMIN']) assert.equal(canAccessStaff(role), true);
  for (const role of ['CUSTOMER', 'STAFF', '', undefined]) assert.equal(canAccessStaff(role), false);
});

test('staff demo fixtures cover all seven AS2 statuses and have internally consistent totals', () => {
  assert.equal(STAFF_DEMO_ORDERS.length, 7);
  assert.deepEqual(new Set(STAFF_DEMO_ORDERS.map((order) => order.status)), new Set(Object.keys(STAFF_STATUSES)));
  for (const order of STAFF_DEMO_ORDERS) {
    assert.match(order.id, /^DEMO-/);
    assert.equal(order.totalAmount, order.items.reduce((sum, item) => sum + item.itemTotal, 0));
    for (const item of order.items) assert.equal(item.itemTotal, item.unitPrice * item.quantity);
    if (order.payment) assert.equal(order.payment.amount, order.totalAmount);
  }
});

test('staff summary and all status filters use actual demo data without altering the source', () => {
  assert.deepEqual(getStaffSummary(STAFF_DEMO_ORDERS), { total: 7, waiting: 1, preparing: 2, completed: 1 });
  for (const status of Object.keys(STAFF_STATUSES)) {
    const result = filterStaffOrders(STAFF_DEMO_ORDERS, status);
    assert.equal(result.length, 1); assert.equal(result[0].status, status);
  }
  assert.equal(filterStaffOrders(STAFF_DEMO_ORDERS, 'ALL').length, 7);
  assert.deepEqual(getStaffSummary([]), { total: 0, waiting: 0, preparing: 0, completed: 0 });
});

test('demo source supports empty/error and returns isolated copies without calling APIs', async () => {
  assert.deepEqual(await loadStaffDemoOrders('empty'), []);
  await assert.rejects(loadStaffDemoOrders('error'), /demo/);
  const orders = await loadStaffDemoOrders('normal');
  orders[0].items[0].quantity = 99;
  assert.notEqual(STAFF_DEMO_ORDERS[0].items[0].quantity, 99);
});

test('each permitted UI transition is disabled and no cancel/payment retry actions are created', () => {
  assert.deepEqual(Object.keys(STAFF_NEXT_ACTION), ['PAID', 'PREPARING', 'READY']);
  assert.deepEqual(Object.values(STAFF_NEXT_ACTION).map((action) => action.status), ['PREPARING', 'READY', 'COMPLETED']);
  const Detail = load('src/components/staff/StaffOrderDetail.tsx').default;
  for (const order of STAFF_DEMO_ORDERS) {
    const html = render(Detail, { order });
    assert.match(html, /chờ API Staff an toàn/);
    assert.match(html, /Demo/);
    if (STAFF_NEXT_ACTION[order.status]) {
      assert.match(html, /<button[^>]*disabled=""/);
      assert.ok(html.includes(STAFF_NEXT_ACTION[order.status].label.replaceAll('&', '&amp;')));
    } else assert.doesNotMatch(html, /<button/);
  }
  const detailed = render(Detail, { order: STAFF_DEMO_ORDERS[1] });
  assert.match(detailed, /Trân châu đen x2/);
  assert.match(detailed, /Ít đá/);
  assert.match(detailed, /Size L/);
  assert.match(detailed, /96\.000/);
  assert.match(detailed, /SePay QR/);
});

test('staff states provide loading announcement, distinct empty messages, error and retry', () => {
  const { StaffLoadingState, StaffEmptyState, StaffErrorState } = load('src/components/staff/StaffStates.tsx');
  assert.match(render(StaffLoadingState, {}), /aria-busy="true"/);
  assert.match(render(StaffEmptyState, { filtered: true, onReset() {} }), /Xem tất cả/);
  assert.match(render(StaffEmptyState, { filtered: false, onReset() {} }), /Tải lại demo/);
  assert.match(render(StaffErrorState, { message: 'Demo error', onRetry() {} }), /role="alert"/);
});

for (const [role, allowed] of [['BARISTA', true], ['ADMIN', true], ['CUSTOMER', false], [undefined, false]]) {
  test(`staff page role ${role}: gate is applied before demo orders can render`, () => {
    const user = { id: 'test-user', fullName: 'Test only', email: 'staff@example.test', role };
    const read = loader({
      react: { ...React, useSyncExternalStore: (_subscribe, snapshot) => snapshot(), useEffect: () => {} },
      '@/hooks/useAuth': { useAuth: () => ({ user, logout() {} }) },
      'next/navigation': { useRouter: () => ({ replace() {} }) },
      '@/hooks/useStaffDemoOrders': { useStaffDemoOrders: () => ({ orders: STAFF_DEMO_ORDERS, status: 'ready', error: '', refreshedAt: null, mode: 'normal', changeMode() {}, refresh() {} }) },
    });
    const Page = read('src/components/staff/StaffPageClient.tsx').default;
    const html = render(Page, {});
    assert.equal(html.includes('DEMO-001'), allowed);
    assert.equal(html.includes('Bạn không có quyền truy cập'), !allowed);
    if (allowed) {
      assert.match(html, /Không tải đơn thật/);
      assert.match(html, /Kiểm tra giao diện demo/);
      assert.match(html, /Làm mới demo/);
    }
  });
}

test('unauthenticated staff visitors are redirected to existing login; server hydration never reveals fixtures', () => {
  const redirects = [];
  const mocks = {
    react: { ...React, useSyncExternalStore: (_subscribe, snapshot) => snapshot(), useEffect: (callback) => callback() },
    '@/hooks/useAuth': { useAuth: () => ({ user: null, logout() {} }) },
    'next/navigation': { useRouter: () => ({ replace: (path) => redirects.push(path) }) },
  };
  const Page = loader(mocks)('src/components/staff/StaffPageClient.tsx').default;
  assert.match(render(Page, {}), /href="\/login"/);
  assert.deepEqual(redirects, ['/login']);
  const ServerPage = loader({ ...mocks, react: { ...React, useSyncExternalStore: (_subscribe, _client, server) => server(), useEffect: () => {} } })('src/components/staff/StaffPageClient.tsx').default;
  assert.doesNotMatch(render(ServerPage, {}), /DEMO-001/);
});

test('demo hook handles load, refresh, empty/error recovery and ignores stale loads after unmount', async () => {
  const slots = []; let cursor = 0; let deps; let pendingEffect; let cleanup;
  const react = {
    useState(initial) {
      const slot = slots[cursor++] ??= { value: initial };
      return [slot.value, (next) => { slot.value = typeof next === 'function' ? next(slot.value) : next; }];
    },
    useCallback: (callback) => callback,
    useEffect(callback, nextDeps) {
      if (!deps || nextDeps.some((value, index) => value !== deps[index])) { deps = nextDeps; pendingEffect = callback; }
    },
  };
  const { useStaffDemoOrders: runHook } = loader({ react })('src/hooks/useStaffDemoOrders.ts');
  function view() {
    cursor = 0; const result = runHook();
    if (pendingEffect) { cleanup?.(); const effect = pendingEffect; pendingEffect = null; cleanup = effect(); }
    return result;
  }
  assert.equal(view().status, 'loading'); await tick(); assert.equal(view().orders.length, 7);
  view().changeMode('loading'); assert.equal(view().status, 'loading'); await tick(); assert.equal(view().status, 'loading');
  view().changeMode('empty'); view(); await tick(); assert.equal(view().orders.length, 0); assert.equal(view().status, 'ready');
  view().changeMode('error'); view(); await tick(); assert.equal(view().status, 'error');
  view().refresh(); view(); await tick(); assert.equal(view().orders.length, 7);
  view().refresh(); view(); cleanup(); await tick();
  assert.equal(view().status, 'loading');
});

test('staff search matches order code, Vietnamese names and table with status intersection', () => {
  assert.deepEqual(filterStaffOrders(STAFF_DEMO_ORDERS, 'ALL', ' #demo-002 ').map((o) => o.id), ['DEMO-002']);
  assert.equal(filterStaffOrders(STAFF_DEMO_ORDERS, 'ALL', 'KHACH DEMO').length, 7);
  assert.equal(filterStaffOrders(STAFF_DEMO_ORDERS, 'ALL', 'Khách demo 2')[0].id, 'DEMO-002');
  assert.equal(filterStaffOrders(STAFF_DEMO_ORDERS, 'ALL', 'ban 2')[0].id, 'DEMO-002');
  assert.equal(filterStaffOrders(STAFF_DEMO_ORDERS, 'PREPARING', 'bàn 2').length, 1);
  assert.equal(filterStaffOrders(STAFF_DEMO_ORDERS, 'PAID', 'bàn 2').length, 0);
  assert.equal(filterStaffOrders(STAFF_DEMO_ORDERS, 'ALL', 'khong ton tai').length, 0);
  const accented = [{ ...STAFF_DEMO_ORDERS[0], customerName: 'Đặng Thị Ánh' }];
  assert.equal(filterStaffOrders(accented, 'ALL', 'dang thi anh').length, 1);
});

test('selection can only resolve an order in the visible result, including empty lists', () => {
  const visible = filterStaffOrders(STAFF_DEMO_ORDERS, 'READY');
  assert.equal(selectStaffOrder(visible, 'DEMO-002').id, 'DEMO-003');
  assert.equal(selectStaffOrder(STAFF_DEMO_ORDERS, 'DEMO-002').id, 'DEMO-002');
  assert.equal(selectStaffOrder([], 'DEMO-002'), undefined);
});

test('dashboard handlers select, search, filter, reset and refresh without leaking hidden details', () => {
  const slots = []; let cursor = 0; let refreshes = 0;
  const react = { ...React,
    useState(initial) {
      const slot = slots[cursor++] ??= { value: initial };
      return [slot.value, (value) => { slot.value = value; }];
    },
    useEffect() {}, useSyncExternalStore: (_sub, snapshot) => snapshot(),
  };
  const Page = loader({ react,
    '@/hooks/useAuth': { useAuth: () => ({ user: { id: 'staff', role: 'BARISTA' }, logout() {} }) },
    'next/navigation': { useRouter: () => ({ replace() {} }) },
    '@/hooks/useStaffDemoOrders': { useStaffDemoOrders: () => ({ orders: STAFF_DEMO_ORDERS, status: 'ready', mode: 'normal', refresh() { refreshes++; }, changeMode() {} }) },
  })('src/components/staff/StaffPageClient.tsx').default;
  const dashboard = Page();
  function nodes() {
    cursor = 0;
    const output = [];
    function visit(value) {
      React.Children.forEach(value, (node) => {
        if (!React.isValidElement(node)) return;
        output.push(node); visit(node.props.children);
      });
    }
    visit(dashboard.type(dashboard.props)); return output;
  }
  const component = (name) => nodes().find((node) => node.type.name === name);
  const button = (label) => nodes().find((node) => node.type === 'button' && React.Children.toArray(node.props.children).includes(label));
  assert.equal(component('StaffOrderDetail').props.order.id, 'DEMO-001');
  const originalWindow = globalThis.window; const originalDocument = globalThis.document;
  let pendingFrame; let focused = false;
  try {
    globalThis.window = { matchMedia: () => ({ matches: true }), requestAnimationFrame: (callback) => { pendingFrame = callback; } };
    globalThis.document = { getElementById: (id) => {
      assert.equal(id, 'staff-order-detail'); return { focus() { focused = true; } };
    } };
    component('StaffOrderList').props.onSelect('DEMO-002');
    assert.equal(component('StaffOrderDetail').props.order.id, 'DEMO-002');
    pendingFrame(); assert.equal(focused, true);
  } finally {
    if (originalWindow === undefined) delete globalThis.window; else globalThis.window = originalWindow;
    if (originalDocument === undefined) delete globalThis.document; else globalThis.document = originalDocument;
  }
  assert.equal(component('StaffOrderDetail').props.order.id, 'DEMO-002');
  button('Sẵn sàng nhận').props.onClick();
  assert.equal(component('StaffOrderDetail').props.order.id, 'DEMO-003');
  nodes().find((node) => node.type === 'input').props.onChange({ target: { value: 'bàn 2' } });
  assert.equal(component('StaffOrderDetail'), undefined);
  assert.equal(component('StaffEmptyState').props.filtered, true);
  component('StaffEmptyState').props.onReset();
  assert.equal(component('StaffOrderList').props.orders.length, 7);
  component('StaffOrderList').props.onSelect('DEMO-005');
  button(' Làm mới demo').props.onClick();
  assert.equal(refreshes, 1);
  assert.equal(component('StaffOrderDetail').props.order.id, 'DEMO-001');
  nodes().find((node) => node.type === 'input').props.onChange({ target: { value: '#demo-002' } });
  assert.equal(component('StaffOrderDetail').props.order.id, 'DEMO-002');
});

const { createStaffApiClient, StaffApiError } = load('src/services/staffApiClient.ts');
const apiOptions = { baseUrl: 'https://staff.example.test/api/', getAccessToken: () => 'test-token' };
const jsonResponse = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
const errorCode = (code) => (error) => error instanceof StaffApiError && error.code === code;

test('staff client is inert until called, uses fresh JWT, GET query encoding and no-store', async () => {
  const calls = []; let token = 'account-a';
  const client = createStaffApiClient({ ...apiOptions, getAccessToken: () => token, fetcher: async (...args) => {
    calls.push(args); return jsonResponse({ success: true, data: STAFF_DEMO_ORDERS, meta: { page: 1, limit: 10, total: 7 } });
  } });
  assert.equal(calls.length, 0);
  const page = await client.listOrders({ status: 'PAID', search: ' bàn 2 ', page: 1, limit: 10 });
  assert.equal(page.data.length, 7); assert.equal(page.meta.total, 7);
  const [url, init] = calls[0];
  assert.equal(new URL(url).pathname, '/api/staff/orders');
  assert.equal(new URL(url).searchParams.get('search'), 'bàn 2');
  assert.equal(new URL(url).searchParams.get('status'), 'PAID');
  assert.equal(init.method, 'GET'); assert.equal(init.cache, 'no-store');
  assert.equal(init.headers.Authorization, 'Bearer account-a'); assert.equal(init.body, undefined);
  token = 'account-b'; await client.listOrders();
  assert.equal(calls[1][1].headers.Authorization, 'Bearer account-b');
});

test('staff detail encodes ID and parses wrapped or direct orders; empty list is valid', async () => {
  const calls = [];
  const client = createStaffApiClient({ ...apiOptions, fetcher: async (url) => {
    calls.push(url); return jsonResponse({ data: STAFF_DEMO_ORDERS[0] });
  } });
  assert.equal((await client.getOrder('order/a ?')).id, 'DEMO-001');
  assert.ok(calls[0].endsWith('/staff/orders/order%2Fa%20%3F'));
  const direct = createStaffApiClient({ ...apiOptions, fetcher: async () => jsonResponse(STAFF_DEMO_ORDERS[1]) });
  assert.equal((await direct.getOrder('DEMO-002')).id, 'DEMO-002');
  const empty = createStaffApiClient({ ...apiOptions, fetcher: async () => jsonResponse([]) });
  assert.deepEqual(await empty.listOrders(), { data: [] });
});

test('staff PATCH stays disabled by default; explicit opt-in only sends requested status once to fake fetch', async () => {
  const calls = [];
  const fetcher = async (...args) => { calls.push(args); return jsonResponse({ data: { ...STAFF_DEMO_ORDERS[0], status: 'PREPARING' } }); };
  const client = createStaffApiClient({ ...apiOptions, fetcher });
  await assert.rejects(client.updateOrderStatus('DEMO-001', { status: 'PREPARING' }), errorCode('WRITES_DISABLED'));
  assert.equal(calls.length, 0);
  const enabled = createStaffApiClient({ ...apiOptions, fetcher, allowStatusUpdates: true });
  assert.equal((await enabled.updateOrderStatus('DEMO-001', { status: 'PREPARING' })).status, 'PREPARING');
  assert.equal(calls.length, 1); assert.ok(calls[0][0].endsWith('/staff/orders/DEMO-001/status'));
  assert.equal(calls[0][1].method, 'PATCH'); assert.deepEqual(JSON.parse(calls[0][1].body), { status: 'PREPARING' });
  await assert.rejects(enabled.updateOrderStatus('DEMO-001', { status: 'CANCELLED' }), errorCode('CONFIGURATION'));
  assert.equal(calls.length, 1);
});

for (const [status, code] of [[401, 'UNAUTHENTICATED'], [403, 'FORBIDDEN'], [404, 'NOT_FOUND'], [409, 'CONFLICT'], [500, 'HTTP']]) {
  test(`staff client handles HTTP ${status} without exposing server text or retrying`, async () => {
    let requests = 0;
    const client = createStaffApiClient({ ...apiOptions, fetcher: async () => { requests++; return new Response('private server text', { status }); } });
    await assert.rejects(client.listOrders(), (error) => {
      assert.equal(error.code, code); assert.equal(error.status, status);
      assert.ok(!error.message.includes('private server text')); return true;
    });
    assert.equal(requests, 1);
  });
}

test('staff client rejects invalid JSON, invalid fields, duplicate IDs and false success without mock fallback', async () => {
  const cases = [null, { success: false, data: STAFF_DEMO_ORDERS }, { data: {} },
    [{ ...STAFF_DEMO_ORDERS[0], totalAmount: '45000' }],
    [{ ...STAFF_DEMO_ORDERS[0], items: [{ ...STAFF_DEMO_ORDERS[0].items[0], quantity: 0 }] }],
    [{ ...STAFF_DEMO_ORDERS[0], status: 'UNKNOWN' }],
    [STAFF_DEMO_ORDERS[0], STAFF_DEMO_ORDERS[0]],
    { data: [], meta: { page: 0, limit: 10, total: 0 } }];
  for (const data of cases) {
    const client = createStaffApiClient({ ...apiOptions, fetcher: async () => jsonResponse(data) });
    await assert.rejects(client.listOrders(), errorCode('INVALID_RESPONSE'));
  }
  const malformed = createStaffApiClient({ ...apiOptions, fetcher: async () => new Response('<html>wrong response</html>') });
  await assert.rejects(malformed.getOrder('a'), errorCode('INVALID_RESPONSE'));
});

test('staff client validates configuration/query/token before any network access', async () => {
  for (const baseUrl of ['', '/api', 'file:///tmp', 'https://user:pass@example.test', 'https://example.test?token=hidden']) {
    assert.throws(() => createStaffApiClient({ ...apiOptions, baseUrl }), errorCode('CONFIGURATION'));
  }
  assert.throws(() => createStaffApiClient({ ...apiOptions, timeoutMs: 0 }), errorCode('CONFIGURATION'));
  const noToken = createStaffApiClient({ ...apiOptions, getAccessToken: () => null });
  await assert.rejects(noToken.listOrders(), errorCode('UNAUTHENTICATED'));
  const client = createStaffApiClient(apiOptions);
  for (const query of [{ page: 0 }, { limit: 1.5 }, { status: 'ALL' }]) await assert.rejects(client.listOrders(query), errorCode('CONFIGURATION'));
  for (const id of ['', '..', '.']) await assert.rejects(client.getOrder(id), errorCode('CONFIGURATION'));
});

test('staff client distinguishes network, timeout, caller abort and abort during response body', async () => {
  const network = createStaffApiClient({ ...apiOptions, fetcher: async () => { throw new TypeError('fetch failed'); } });
  await assert.rejects(network.listOrders(), errorCode('NETWORK'));
  const pendingFetch = (_url, { signal }) => new Promise((_resolve, reject) => signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true }));
  const timeout = createStaffApiClient({ ...apiOptions, timeoutMs: 5, fetcher: pendingFetch });
  await assert.rejects(timeout.listOrders(), errorCode('TIMEOUT'));
  const controller = new AbortController();
  const abortable = createStaffApiClient({ ...apiOptions, fetcher: pendingFetch });
  const request = abortable.listOrders({}, { signal: controller.signal }); controller.abort();
  await assert.rejects(request, errorCode('ABORTED'));
  await assert.rejects(abortable.listOrders({}, { signal: controller.signal }), errorCode('ABORTED'));
  const bodyTimeout = createStaffApiClient({ ...apiOptions, timeoutMs: 5, fetcher: async (_url, { signal }) => ({
    ok: true, json: () => pendingFetch('', { signal }),
  }) });
  await assert.rejects(bodyTimeout.getOrder('a'), errorCode('TIMEOUT'));
});
