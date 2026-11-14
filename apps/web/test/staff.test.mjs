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
    new Function('require', 'module', 'exports', 'fetch', 'process', 'window', code)(
      localRequire, loaded, loaded.exports, fetcher, mocks.process ?? process, mocks.window ?? globalThis.window,
    );
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
    assert.match(html, /chờ xác minh quy tắc thanh toán/);
    assert.doesNotMatch(html, /Chi tiết đơn · Demo/);
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
  assert.match(render(StaffEmptyState, { filtered: false, onReset() {} }), /Tải lại danh sách/);
  assert.match(render(StaffErrorState, { message: 'Demo error', onRetry() {} }), /role="alert"/);
});

function staffView(overrides = {}) {
  return { orders: STAFF_DEMO_ORDERS, visibleOrders: STAFF_DEMO_ORDERS, selectedId: 'DEMO-001',
    detail: { status: 'ready', data: STAFF_DEMO_ORDERS[0] }, status: 'ready', error: '',
    pagination: { page: 1, limit: 10, total: 17, totalPages: 2 }, page: 1, filter: 'ALL', search: '',
    changeFilter() {}, changePage() {}, changeSearch() {}, selectOrder() {}, resetFilters() {}, refresh() {}, retryDetail() {}, ...overrides };
}

for (const [role, allowed] of [['BARISTA', true], ['ADMIN', true], ['CUSTOMER', false], [undefined, false]]) {
  test(`staff page role ${role}: gate is applied before demo orders can render`, () => {
    const user = { id: 'test-user', fullName: 'Test only', email: 'staff@example.test', role };
    const read = loader({
      react: { ...React, useSyncExternalStore: (_subscribe, snapshot) => snapshot(), useEffect: () => {} },
      '@/hooks/useAuth': { useAuth: () => ({ user, logout() {} }) },
      'next/navigation': { useRouter: () => ({ replace() {} }) },
      '@/hooks/useStaffOrders': { useStaffOrders: () => staffView() },
    });
    const Page = read('src/components/staff/StaffPageClient.tsx').default;
    const html = render(Page, {});
    assert.equal(html.includes('DEMO-001'), allowed);
    assert.equal(html.includes('Bạn không có quyền truy cập'), !allowed);
    if (allowed) {
      assert.doesNotMatch(html, /Thông tin quầy nhân viên|Chỉ xem đơn hàng|Thống kê đơn trong trang hiện tại/);
      assert.doesNotMatch(html, /Đơn trong trang|Chờ pha chế|Đang thực hiện/);
      for (const status of Object.keys(STAFF_STATUSES)) {
        assert.ok(html.includes(`<option value="${status}">${status}</option>`));
      }
      assert.match(html, /trong trang hiện tại/);
      assert.match(html, /Làm mới/);
      assert.doesNotMatch(html, /Kiểm tra giao diện demo/);
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

test('dashboard renders API loading, empty, errors, pagination and detail independently', () => {
  let state = staffView(); const calls = [];
  const Page = loader({
    react: { ...React, useEffect() {}, useSyncExternalStore: (_sub, snapshot) => snapshot() },
    '@/hooks/useAuth': { useAuth: () => ({ user: { id: 'staff', role: 'BARISTA' }, logout() {} }) },
    'next/navigation': { useRouter: () => ({ replace() {} }) },
    '@/hooks/useStaffOrders': { useStaffOrders: () => state },
  })('src/components/staff/StaffPageClient.tsx').default;
  let html = render(Page, {});
  assert.match(html, /Phân trang đơn hàng/); assert.match(html, /17 đơn theo bộ lọc/);
  assert.equal((html.match(/id="staff-order-detail"/g) ?? []).length, 1);
  state = staffView({ detail: { status: 'loading' } });
  html = render(Page, {}); assert.match(html, /aria-busy="true"/); assert.doesNotMatch(html, /Chi tiết đơn hàng<\/p>/);
  state = staffView({ detail: { status: 'error', error: { code: 'NOT_FOUND', message: 'Missing order' } } });
  assert.match(render(Page, {}), /Đơn hàng không còn tồn tại/);
  state = staffView({ status: 'error', error: 'Forbidden', orders: [], visibleOrders: [], detail: { status: 'idle' } });
  html = render(Page, {}); assert.match(html, /Forbidden/); assert.doesNotMatch(html, /DEMO-001/);
  state = staffView({ orders: [], visibleOrders: [], selectedId: undefined, detail: { status: 'idle' },
    pagination: { page: 1, limit: 10, total: 0, totalPages: 0 } });
  html = render(Page, {}); assert.match(html, /Chưa có đơn hàng/); assert.doesNotMatch(html, /DEMO-001/);
  state = staffView({ changePage: (value) => calls.push(['page', value]), changeFilter: (value) => calls.push(['filter', value]),
    changeSearch: (value) => calls.push(['search', value]), selectOrder: (value) => calls.push(['select', value]), refresh: () => calls.push(['refresh']) });
  const dashboard = Page(); const output = [];
  function visit(value) { React.Children.forEach(value, (node) => { if (React.isValidElement(node)) { output.push(node); visit(node.props.children); } }); }
  visit(dashboard.type(dashboard.props));
  output.find((node) => node.type === 'button' && node.props.children === 'Trang sau').props.onClick();
  output.find((node) => node.type === 'button' && node.props.children === 'READY').props.onClick();
  output.find((node) => node.type === 'input').props.onChange({ target: { value: 'ban 2' } });
  output.find((node) => node.type.name === 'StaffOrderList').props.onSelect('DEMO-002');
  output.find((node) => node.type === 'select').props.onChange({ target: { value: 'PAID' } });
  assert.deepEqual(calls, [['page', 2], ['filter', 'READY'], ['search', 'ban 2'], ['select', 'DEMO-002'], ['filter', 'PAID']]);
});

test('floating cart and its spacer/notification are hidden only on Staff and existing cart exclusions', () => {
  let pathname = '/staff'; let cart = { itemCount: 2, hydrated: true };
  const Button = loader({
    'next/navigation': { usePathname: () => pathname },
    '@/context/useCart': { useCart: () => cart },
  })('src/components/cart/FloatingCartButton.tsx').default;
  for (pathname of ['/staff', '/staff/', '/staff/orders/123', '/cart']) {
    assert.equal(render(Button, { showAddedNotification: true }), '');
  }
  for (pathname of ['/menu', '/checkout', '/orders', '/', '/staffing']) {
    const html = render(Button, { showAddedNotification: true });
    assert.match(html, /Xem giỏ hàng, 2 sản phẩm/); assert.match(html, /Đã thêm vào giỏ hàng/);
  }
  pathname = '/menu'; cart = { itemCount: 0, hydrated: true };
  assert.equal(render(Button, { showAddedNotification: false }), '');
  cart = { itemCount: 2, hydrated: false };
  assert.equal(render(Button, { showAddedNotification: false }), '');
});

test('Staff placeholders distinguish loading, an empty database and an empty page', () => {
  const { StaffLoadingState, StaffEmptyState } = load('src/components/staff/StaffStates.tsx');
  assert.match(render(StaffLoadingState, { variant: 'detail' }), /Đang tải chi tiết đơn hàng/);
  const noOrders = render(StaffEmptyState, { filtered: false, onReset() {} });
  assert.match(noOrders, /Quầy đã sẵn sàng/); assert.doesNotMatch(noOrders, /database|mock|demo/i);
  assert.match(render(StaffEmptyState, { filtered: false, hasOrders: true, onReset() {} }), /Trang này chưa có đơn/);
});

test('Staff order status labels use enum names in badges/list/detail without translating payment or customer data', () => {
  const Badge = load('src/components/staff/StaffOrderStatus.tsx').default;
  const List = load('src/components/staff/StaffOrderList.tsx').default;
  const Detail = load('src/components/staff/StaffOrderDetail.tsx').default;
  for (const order of STAFF_DEMO_ORDERS) {
    assert.equal(STAFF_STATUSES[order.status].label, order.status);
    for (const html of [render(Badge, { status: order.status }),
      render(List, { orders: [order], onSelect() {} }), render(Detail, { order })]) {
      assert.ok(html.includes(`>${order.status}</span>`));
    }
    const html = render(Detail, { order });
    assert.ok(html.includes(order.customerName)); assert.ok(html.includes(order.items[0].productName));
    if (order.payment?.status === 'SUCCESS') assert.match(html, /Đã thanh toán<\/dd>/);
  }
  assert.doesNotMatch(readFileSync(resolve(root, 'src/components/staff/StaffPageClient.tsx'), 'utf8'), /StaffSummary/);
});

const { createStaffApiClient, StaffApiError } = load('src/services/staffApiClient.ts');
const apiOptions = { baseUrl: 'https://staff.example.test/', getAccessToken: () => 'test-token' };
const jsonResponse = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
const errorCode = (code) => (error) => error instanceof StaffApiError && error.code === code;

// Synthetic JSON matching Prisma Order + StaffService's explicit payment selection.
// Independent of the dashboard demo; no real backend or database is accessed.
const backendScalar = {
  id: 'order-contract-1', userId: null, customerName: 'Khách kiểm thử', customerPhone: '0900000000',
  tableNumber: 2, notes: null, subtotalAmount: 60000, discountAmount: 5000, totalAmount: 55000,
  status: 'PAID', reservationStatus: 'CONSUMED', reservationExpiresAt: null,
  promotionId: 'promotion-contract-1', promotionCode: 'TEST5K',
  createdAt: '2026-11-14T03:00:00.000Z', updatedAt: '2026-11-14T03:01:00.000Z',
};
const backendOrder = {
  ...backendScalar,
  items: [{ id: 'item-contract-1', orderId: backendScalar.id, productId: 'product-contract-1',
    productName: 'Cà phê sữa', unitPrice: 30000, quantity: 2, size: 'M', toppings: null, itemTotal: 60000 }],
  payment: { id: 'payment-contract-1', amount: 55000, method: 'SEPAY_QR', status: 'SUCCESS', paidAt: '2026-11-14T03:01:00.000Z' },
};
const backendPage = (data = [backendOrder], pagination = { page: 1, limit: 20, total: data.length, totalPages: data.length ? 1 : 0 }) => ({ data, pagination });

test('staff client is inert until called, uses fresh JWT, GET query encoding and no-store', async () => {
  const calls = []; let token = 'account-a';
  const client = createStaffApiClient({ ...apiOptions, getAccessToken: () => token, fetcher: async (...args) => {
    calls.push(args); return jsonResponse(backendPage());
  } });
  assert.equal(calls.length, 0);
  const page = await client.listOrders({ status: 'PAID', page: 1, limit: 20 });
  assert.deepEqual(page, backendPage());
  const [url, init] = calls[0];
  assert.equal(new URL(url).pathname, '/staff/orders');
  assert.equal(new URL(url).searchParams.has('search'), false);
  assert.equal(new URL(url).searchParams.get('page'), '1');
  assert.equal(new URL(url).searchParams.get('limit'), '20');
  assert.equal(new URL(url).searchParams.get('status'), 'PAID');
  assert.equal(init.method, 'GET'); assert.equal(init.cache, 'no-store');
  assert.equal(init.headers.Authorization, 'Bearer account-a'); assert.equal(init.body, undefined);
  token = 'account-b'; await client.listOrders();
  assert.equal(calls[1][1].headers.Authorization, 'Bearer account-b');
});

test('staff detail accepts backend payment without orderId, encodes IDs and accepts null payment', async () => {
  const calls = [];
  const client = createStaffApiClient({ ...apiOptions, fetcher: async (url) => {
    calls.push(url); return jsonResponse(backendOrder);
  } });
  assert.deepEqual(await client.getOrder('order/a ?'), backendOrder);
  assert.ok(calls[0].endsWith('/staff/orders/order%2Fa%20%3F'));
  const direct = createStaffApiClient({ ...apiOptions, fetcher: async () => jsonResponse({ ...backendOrder, payment: null }) });
  assert.equal((await direct.getOrder(backendScalar.id)).payment, null);
  const empty = createStaffApiClient({ ...apiOptions, fetcher: async () => jsonResponse(backendPage([])) });
  assert.deepEqual(await empty.listOrders(), backendPage([]));
  const beyond = backendPage([], { page: 3, limit: 20, total: 1, totalPages: 1 });
  const outOfRange = createStaffApiClient({ ...apiOptions, fetcher: async () => jsonResponse(beyond) });
  assert.deepEqual(await outOfRange.listOrders({ page: 3 }), beyond);
});

test('staff PATCH stays disabled by default; explicit opt-in only sends requested status once to fake fetch', async () => {
  const calls = [];
  const fetcher = async (...args) => { calls.push(args); return jsonResponse({ ...backendScalar, status: 'PREPARING' }); };
  const client = createStaffApiClient({ ...apiOptions, fetcher });
  await assert.rejects(client.updateOrderStatus('DEMO-001', { status: 'PREPARING' }), errorCode('WRITES_DISABLED'));
  assert.equal(calls.length, 0);
  const enabled = createStaffApiClient({ ...apiOptions, fetcher, allowStatusUpdates: true });
  const result = await enabled.updateOrderStatus('DEMO-001', { status: 'PREPARING' });
  assert.deepEqual(result, { ...backendScalar, status: 'PREPARING' });
  assert.equal('items' in result, false); assert.equal('payment' in result, false);
  assert.equal(calls.length, 1); assert.ok(calls[0][0].endsWith('/staff/orders/DEMO-001/status'));
  assert.equal(calls[0][1].method, 'PATCH'); assert.deepEqual(JSON.parse(calls[0][1].body), { status: 'PREPARING' });
  await assert.rejects(enabled.updateOrderStatus('DEMO-001', { status: 'CANCELLED' }), errorCode('CONFIGURATION'));
  assert.equal(calls.length, 1);
});

for (const [status, code] of [[400, 'BAD_REQUEST'], [401, 'UNAUTHENTICATED'], [403, 'FORBIDDEN'], [404, 'NOT_FOUND'], [409, 'CONFLICT'], [500, 'HTTP']]) {
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
  const cases = [null, { success: false, ...backendPage() }, { data: {} },
    backendPage([{ ...backendOrder, totalAmount: '55000' }]),
    backendPage([{ ...backendOrder, items: [{ ...backendOrder.items[0], quantity: 0 }] }]),
    backendPage([{ ...backendOrder, status: 'UNKNOWN' }]),
    backendPage([{ ...backendOrder, payment: { ...backendOrder.payment, status: 'PAID' } }]),
    backendPage([backendOrder, backendOrder]),
    [backendOrder], { data: [], meta: { page: 1, limit: 20, total: 0 } },
    ...[{ page: 0 }, { limit: 101 }, { total: -1 }, { totalPages: undefined }, { totalPages: 2 }]
      .map((change) => backendPage([], { page: 1, limit: 20, total: 0, totalPages: 0, ...change }))];
  for (const data of cases) {
    const client = createStaffApiClient({ ...apiOptions, fetcher: async () => jsonResponse(data) });
    await assert.rejects(client.listOrders(), errorCode('INVALID_RESPONSE'));
  }
  const malformed = createStaffApiClient({ ...apiOptions, fetcher: async () => new Response('<html>wrong response</html>') });
  await assert.rejects(malformed.getOrder('a'), errorCode('INVALID_RESPONSE'));
  for (const payload of [backendScalar, { data: backendOrder }]) {
    const detail = createStaffApiClient({ ...apiOptions, fetcher: async () => jsonResponse(payload) });
    await assert.rejects(detail.getOrder('a'), errorCode('INVALID_RESPONSE'));
  }
  const badPatch = createStaffApiClient({ ...apiOptions, allowStatusUpdates: true,
    fetcher: async () => jsonResponse({ ...backendScalar, status: 'UNKNOWN' }) });
  await assert.rejects(badPatch.updateOrderStatus('a', { status: 'READY' }), errorCode('INVALID_RESPONSE'));
});

test('staff client validates configuration/query/token before any network access', async () => {
  for (const baseUrl of ['', '/api', 'file:///tmp', 'https://user:pass@example.test', 'https://example.test?token=hidden']) {
    assert.throws(() => createStaffApiClient({ ...apiOptions, baseUrl }), errorCode('CONFIGURATION'));
  }
  assert.throws(() => createStaffApiClient({ ...apiOptions, timeoutMs: 0 }), errorCode('CONFIGURATION'));
  const noToken = createStaffApiClient({ ...apiOptions, getAccessToken: () => null });
  await assert.rejects(noToken.listOrders(), errorCode('UNAUTHENTICATED'));
  let calls = 0;
  const urls = [];
  const client = createStaffApiClient({ ...apiOptions, fetcher: async (url) => { calls++; urls.push(url); return jsonResponse(backendPage([])); } });
  for (const query of [{ page: 0 }, { page: -1 }, { page: 1.5 }, { page: '1' }, { page: NaN },
    { page: 2147483648 }, { page: 2147483647 }, { page: 2147483647, limit: 100 },
    { page: 107374184 },
    { limit: 0 }, { limit: 1.5 }, { limit: 101 }, { limit: Infinity }, { status: 'ALL' }]) {
    await assert.rejects(client.listOrders(query), errorCode('CONFIGURATION'));
  }
  for (const id of ['', '..', '.']) await assert.rejects(client.getOrder(id), errorCode('CONFIGURATION'));
  assert.equal(calls, 0);
  for (const query of [{ page: 2147483647, limit: 1 }, { page: 21474837, limit: 100 }, { limit: 100 }, { page: 107374183 }]) {
    await client.listOrders(query);
  }
  assert.equal(calls, 4);
  await client.listOrders({ search: 'unsupported' });
  assert.equal(new URL(urls.at(-1)).searchParams.has('search'), false);
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

// Exercise the actual hook + API client + parsers. Only HTTP and the existing session are simulated.
function apiHook(fetcher, { baseUrl = 'https://staff.example.test', token = 'session-token' } = {}) {
  const slots = []; let cursor = 0; let pending = []; let cleared = 0;
  const changed = (previous, next) => !previous || next.some((value, index) => !Object.is(value, previous[index]));
  const react = {
    useState(initial) {
      const index = cursor++; const slot = slots[index] ??= { value: initial };
      return [slot.value, (next) => { slot.value = typeof next === 'function' ? next(slot.value) : next; }];
    },
    useCallback(callback, deps) {
      const index = cursor++; const slot = slots[index] ??= {};
      if (changed(slot.deps, deps)) { slot.deps = deps; slot.callback = callback; }
      return slot.callback;
    },
    useEffect(effect, deps) {
      const index = cursor++; const slot = slots[index] ??= {};
      if (changed(slot.deps, deps)) {
        slot.deps = deps;
        pending.push(() => { slot.cleanup?.(); slot.cleanup = effect(); });
      }
    },
  };
  const hook = loader({ react, process: { env: { NEXT_PUBLIC_API_URL: baseUrl } },
    window: { localStorage: { getItem: (key) => { assert.equal(key, 'token'); return token; } } },
    '@/lib/auth': { clearAuthSession: () => { cleared++; } },
  }, fetcher)('src/hooks/useStaffOrders.ts').useStaffOrders;
  const render = () => { cursor = 0; const view = hook(); const effects = pending; pending = []; effects.forEach((run) => run()); return view; };
  return { render, async settle() { await tick(); return render(); },
    unmount() { slots.forEach((slot) => slot.cleanup?.()); }, get cleared() { return cleared; } };
}

test('API hook shows loading, genuine empty, errors and refresh without demo fallback', async () => {
  const calls = []; let respond;
  const host = apiHook((url, init) => { calls.push({ url, init }); return new Promise((resolve) => { respond = resolve; }); });
  try {
    assert.equal(host.render().status, 'loading');
    assert.equal(new URL(calls[0].url).pathname, '/staff/orders');
    assert.equal(calls[0].init.headers.Authorization, 'Bearer session-token');
    assert.equal(calls[0].init.method, 'GET');
    respond(jsonResponse(backendPage([])));
    let view = await host.settle(); assert.equal(view.status, 'ready'); assert.deepEqual(view.orders, []);
    assert.equal(view.detail.status, 'idle'); assert.equal(calls.length, 1);
    view.refresh(); view = host.render(); assert.equal(view.status, 'loading'); assert.deepEqual(view.orders, []);
    respond(new Response('server error', { status: 500 }));
    view = await host.settle(); assert.equal(view.status, 'error'); assert.deepEqual(view.orders, []);
    view.refresh(); host.render(); respond(jsonResponse(backendPage([])));
    assert.equal((await host.settle()).status, 'ready');
  } finally { host.unmount(); }
});

test('API hook sends server filters/pages, searches Vietnamese locally and fetches detail separately', async () => {
  const calls = [];
  const host = apiHook(async (url, init) => {
    calls.push({ url: new URL(url), init });
    return jsonResponse(new URL(url).pathname === '/staff/orders'
      ? backendPage([backendOrder], { page: Number(new URL(url).searchParams.get('page')), limit: 10, total: 12, totalPages: 2 })
      : { ...backendOrder, notes: 'Authoritative detail' });
  });
  try {
    host.render(); let view = await host.settle();
    assert.equal(view.detail.status, 'loading'); assert.equal(view.detail.data, undefined);
    view = await host.settle(); assert.equal(view.detail.data.notes, 'Authoritative detail');
    assert.equal(calls.filter((call) => call.url.pathname === '/staff/orders').length, 1);
    view.changeSearch('khach kiem thu'); view = host.render(); assert.equal(view.visibleOrders.length, 1);
    view.changeSearch('missing'); view = host.render(); assert.deepEqual(view.visibleOrders, []); assert.equal(view.detail.status, 'idle');
    assert.equal(calls.filter((call) => call.url.pathname === '/staff/orders').length, 1);
    view.changePage(2); view = host.render(); assert.equal(view.status, 'loading'); assert.deepEqual(view.orders, []);
    view = await host.settle(); assert.equal(view.pagination.page, 2);
    view.changeFilter('READY'); host.render(); view = await host.settle();
    assert.equal(view.page, 1); assert.equal(view.filter, 'READY');
    const request = calls.filter((call) => call.url.pathname === '/staff/orders').at(-1);
    assert.equal(request.url.searchParams.get('status'), 'READY'); assert.equal(request.url.searchParams.get('limit'), '10');
    for (const call of calls) { assert.equal(call.init.method, 'GET'); assert.equal(call.url.searchParams.has('search'), false); }
  } finally { host.unmount(); }
});

test('API hook aborts obsolete detail, ignores late replies and handles detail 404/retry', async () => {
  const other = { ...backendOrder, id: 'order-contract-2', items: backendOrder.items.map((item) => ({ ...item, orderId: 'order-contract-2' })) };
  const details = [];
  const host = apiHook((url, init) => new URL(url).pathname === '/staff/orders'
    ? Promise.resolve(jsonResponse(backendPage([backendOrder, other])))
    : new Promise((resolve) => details.push({ url, init, resolve })));
  try {
    host.render(); let view = await host.settle(); assert.equal(details.length, 1);
    view.selectOrder(other.id); view = host.render(); assert.equal(view.detail.status, 'loading');
    assert.equal(details[0].init.signal.aborted, true);
    details[1].resolve(jsonResponse(other)); view = await host.settle(); assert.equal(view.detail.data.id, other.id);
    details[0].resolve(jsonResponse(backendOrder)); view = await host.settle(); assert.equal(view.detail.data.id, other.id);
    view.selectOrder(backendOrder.id); host.render(); details[2].resolve(new Response('missing', { status: 404 }));
    view = await host.settle(); assert.equal(view.detail.error.code, 'NOT_FOUND'); assert.equal(view.detail.data, undefined);
    view.retryDetail(); host.render(); details[3].resolve(jsonResponse(backendOrder));
    view = await host.settle(); assert.equal(view.detail.data.id, backendOrder.id);
  } finally { host.unmount(); }
});

for (const status of [401, 403]) {
  for (const endpoint of ['list', 'detail']) {
    test(`API hook clears visible private data on ${endpoint} ${status}`, async () => {
      const host = apiHook(async (url) => endpoint === 'detail' && new URL(url).pathname === '/staff/orders'
        ? jsonResponse(backendPage()) : new Response('denied', { status }));
      try {
        host.render(); await host.settle(); const view = await host.settle();
        assert.equal(view.errorCode, status === 401 ? 'UNAUTHENTICATED' : 'FORBIDDEN');
        assert.equal(view.status, 'error'); assert.deepEqual(view.orders, []); assert.equal(view.detail.data, undefined);
        assert.equal(host.cleared, status === 401 ? 1 : 0);
      } finally { host.unmount(); }
    });
  }
}

test('API hook aborts list on refresh/unmount and ignores stale responses', async () => {
  const requests = [];
  const host = apiHook((_url, init) => new Promise((resolve) => requests.push({ init, resolve })));
  let view = host.render(); view.refresh(); host.render(); assert.equal(requests[0].init.signal.aborted, true);
  requests[1].resolve(jsonResponse(backendPage([]))); view = await host.settle(); assert.deepEqual(view.orders, []);
  requests[0].resolve(jsonResponse(backendPage())); view = await host.settle(); assert.deepEqual(view.orders, []);
  view.refresh(); host.render(); host.unmount(); assert.equal(requests[2].init.signal.aborted, true);
  requests[2].resolve(jsonResponse(backendPage())); await tick();
});

test('API hook reports missing API configuration/token and never falls back to mock', async () => {
  for (const [options, code] of [[{ baseUrl: '' }, 'CONFIGURATION'], [{ token: null }, 'UNAUTHENTICATED']]) {
    let calls = 0; const host = apiHook(async () => { calls++; throw new Error('Must not fetch'); }, options);
    try { host.render(); const view = await host.settle(); assert.equal(view.errorCode, code); assert.deepEqual(view.orders, []); assert.equal(calls, 0); }
    finally { host.unmount(); }
  }
  for (const file of ['src/components/staff/StaffPageClient.tsx', 'src/hooks/useStaffOrders.ts']) {
    assert.doesNotMatch(readFileSync(resolve(root, file), 'utf8'), /useStaffDemoOrders|staffDemoOrders|allowStatusUpdates:\s*true/);
  }
});

test('reselecting the active order or filter does not refetch; explicit refresh still does', async () => {
  const requests = [];
  const host = apiHook(async (url) => {
    requests.push(url);
    return jsonResponse(new URL(url).pathname === '/staff/orders' ? backendPage() : backendOrder);
  });
  try {
    host.render(); await host.settle(); let view = await host.settle();
    assert.equal(requests.length, 2);
    host.render(); host.render(); assert.equal(requests.length, 2);
    view.selectOrder(view.selectedId); view = host.render(); await host.settle();
    assert.equal(requests.length, 2, 'clicking the selected order must not repeat its detail GET');
    view.changeFilter(view.filter); view = host.render(); await host.settle();
    assert.equal(requests.length, 2, 'clicking the active filter must not reload the page');
    view.refresh(); host.render(); await host.settle(); await host.settle();
    assert.equal(requests.length, 4, 'explicit refresh reloads the list and selected detail');
  } finally { host.unmount(); }
});
