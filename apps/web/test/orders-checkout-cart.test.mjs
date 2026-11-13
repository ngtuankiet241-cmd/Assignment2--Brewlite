import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import { browserStorage, elements, hookRuntime, loadFrontend, tick } from './helpers/frontend-runtime.mjs';

const tokenFor = (id, exp = Math.floor(Date.now() / 1000) + 3600) =>
  `header.${Buffer.from(JSON.stringify({ userId: id, exp })).toString('base64url')}.signature-${id}`;
const product = { id: 'product-1', name: 'Cà phê sữa', description: 'Coffee', imageUrl: '/coffee.svg', categoryName: 'Coffee', price: 29000, stock: 50 };
const pearls = { id: 'pearls', name: 'Trân châu đen', unitPrice: 7000, quantity: 2 };
const foam = { id: 'cheese-foam', name: 'Kem cheese', unitPrice: 10000, quantity: 1 };
const markup = renderToStaticMarkup;

function ordersPage(fetcher) {
  const browser = browserStorage();
  const runtime = hookRuntime();
  const calls = [];
  const load = loadFrontend({ mocks: { react: runtime.react }, globals: {
    window: browser.window,
    setTimeout: browser.window.setTimeout, clearTimeout: browser.window.clearTimeout,
    fetch: (url, options) => { calls.push({ url, options }); return fetcher(url, options); },
  } });
  const auth = load('src/lib/auth.ts');
  const Page = load('src/components/orders/OrdersPageClient.tsx').default;
  const parent = runtime.host();
  let child;
  let key;
  return {
    ...browser, auth, calls,
    login(id, token = tokenFor(id)) {
      auth.saveAuthSession({ accessToken: token, user: { id, email: `${id}@example.test`, fullName: id } });
    },
    render() {
      const tree = parent.render(Page);
      const notice = elements(tree).find((element) => element.type.name === 'VerifiedHistoryNotice');
      if (!notice) { child?.dispose(); child = undefined; key = undefined; return tree; }
      if (!child || key !== notice.key) { child?.dispose(); child = runtime.host(); key = notice.key; }
      return child.render(notice.type, notice.props);
    },
    dispose() { parent.dispose(); child?.dispose(); },
  };
}

test('orders: guest sees login link and makes no API request', () => {
  const page = ordersPage(() => { throw new Error('Guest request'); });
  assert.match(markup(page.render()), /Vui lòng đăng nhập/);
  assert.match(markup(page.render()), /href="\/login"/);
  assert.equal(page.calls.length, 0);
  page.dispose();
});

test('orders: validates session, then shows unavailable notice without fetching any orders', async () => {
  const page = ordersPage(async () => Response.json({ userId: 'A', orders: ['must not render'] }));
  page.login('A');
  assert.match(markup(page.render()), /aria-busy="true"/);
  await tick();
  const html = markup(page.render());
  assert.match(html, /Lịch sử đơn hàng đang được hoàn thiện/);
  assert.doesNotMatch(html, /must not render|Chưa có đơn hàng nào/);
  assert.equal(page.calls.length, 1);
  assert.equal(page.calls[0].url, 'https://api.example.test/auth/me');
  assert.equal(page.calls[0].options.headers.Authorization, `Bearer ${tokenFor('A')}`);
  page.dispose();
});

test('orders: logout aborts an in-flight request; late results cannot restore the page', async () => {
  let respond;
  const page = ordersPage(() => new Promise((done) => { respond = done; }));
  page.login('A'); page.render();
  const signal = page.calls[0].options.signal;
  page.auth.clearAuthSession();
  assert.match(markup(page.render()), /Vui lòng đăng nhập/);
  assert.equal(signal.aborted, true);
  respond(Response.json({ userId: 'A' })); await tick();
  assert.match(markup(page.render()), /Vui lòng đăng nhập/);
  page.dispose();
});

test('orders: switching accounts aborts A; a late 401 from A cannot log B out', async () => {
  let respondA;
  const page = ordersPage((_url, options) => options.headers.Authorization.endsWith('signature-A')
    ? new Promise((done) => { respondA = done; }) : Promise.resolve(Response.json({ userId: 'B' })));
  page.login('A'); page.render();
  page.login('B'); page.render();
  assert.equal(page.calls[0].options.signal.aborted, true);
  await tick(); respondA(new Response(null, { status: 401 })); await tick();
  assert.equal(page.auth.getAuthTokenSnapshot(), tokenFor('B'));
  assert.match(markup(page.render()), /Lịch sử đơn hàng đang được hoàn thiện/);
  assert.equal(page.calls.length, 2);
  page.dispose();
});

test('orders: token expiry notifies subscribers, clears displayed state and aborts request', () => {
  const originalNow = Date.now;
  const start = originalNow();
  Date.now = () => start;
  const page = ordersPage(() => new Promise(() => {}));
  let notifications = 0;
  const unsubscribe = page.auth.subscribeAuthChanges(() => notifications++);
  try {
    page.login('A', tokenFor('A', Math.floor(start / 1000) + 5)); page.render();
    Date.now = () => start + 7000;
    page.fireTimers(({ delay }) => delay < 10000);
    assert.ok(notifications >= 2);
    assert.match(markup(page.render()), /Vui lòng đăng nhập/);
    assert.equal(page.calls[0].options.signal.aborted, true);
  } finally { unsubscribe(); page.dispose(); Date.now = originalNow; }
});

test('orders: 401 removes current session and returns to login prompt', async () => {
  const page = ordersPage(async () => new Response(null, { status: 401 }));
  page.login('A'); page.render(); await tick();
  assert.equal(page.values.has('token'), false);
  assert.match(markup(page.render()), /Vui lòng đăng nhập/);
  page.dispose();
});

test('orders: token rotation for the same user resets request state', async () => {
  const page = ordersPage(async () => Response.json({ userId: 'A' }));
  page.login('A'); page.render(); await tick(); page.render();
  page.login('A', tokenFor('A', Math.floor(Date.now() / 1000) + 7200));
  assert.match(markup(page.render()), /aria-busy="true"/);
  assert.equal(page.calls[0].options.signal.aborted, true);
  await tick(); assert.match(markup(page.render()), /đang được hoàn thiện/);
  page.dispose();
});

test('orders: HTTP failure supports retry; timeout presents Error', async () => {
  let failed = true;
  const page = ordersPage(async () => failed ? new Response(null, { status: 500 }) : Response.json({}));
  page.login('A'); page.render(); await tick();
  assert.match(markup(page.render()), /role="alert"/);
  failed = false;
  elements(page.render()).find((element) => element.type === 'button').props.onClick();
  assert.match(markup(page.render()), /aria-busy="true"/);
  await tick(); assert.match(markup(page.render()), /đang được hoàn thiện/);
  page.dispose();

  const slow = ordersPage((_url, { signal }) => new Promise((_, reject) => {
    signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
  }));
  slow.login('A'); slow.render(); slow.fireTimers(({ delay }) => delay === 10000);
  await tick(); assert.match(markup(slow.render()), /role="alert"/);
  slow.dispose();
});

function cartHost(browser = browserStorage()) {
  const runtime = hookRuntime();
  const host = runtime.host();
  const load = loadFrontend({ mocks: {
    react: runtime.react,
    '@/components/cart/FloatingCartButton': { __esModule: true, default: () => null },
  }, globals: { window: browser.window, setTimeout: browser.window.setTimeout, clearTimeout: browser.window.clearTimeout } });
  const { CartProvider } = load('src/context/CartContext.tsx');
  return { ...browser, load, render: () => host.render(CartProvider).props.value, dispose: host.dispose };
}

test('cart: real provider preserves toppings, separates configurations, merges matching configurations and restores after reload', () => {
  const cart = cartHost();
  assert.equal(cart.render().hydrated, false);
  cart.fireTimers(({ delay }) => delay === 0);
  assert.equal(cart.render().hydrated, true);
  cart.render().addItem({ product, size: 'L', toppings: [pearls, foam], quantity: 2 });
  assert.deepEqual(cart.render().items[0].toppings, [pearls, foam]);
  assert.equal(cart.render().subtotal, (29000 + 5000 + 14000 + 10000) * 2);
  cart.render().addItem({ product, size: 'L', toppings: [{ ...pearls, quantity: 1 }], quantity: 1 });
  assert.equal(cart.render().items.length, 2);
  cart.render().addItem({ product, size: 'L', toppings: [foam, pearls], quantity: 1 });
  assert.equal(cart.render().items.length, 2);
  assert.equal(cart.render().items[0].quantity, 3);
  const id = cart.render().items[0].id;
  cart.render().updateQuantity(id, 5);
  cart.render().updateQuantity(id, 1);
  assert.deepEqual(cart.render().items[0].toppings, [pearls, foam]);
  assert.equal(cart.render().subtotal, 58000 + 41000);
  const saved = structuredClone(cart.render().items);
  cart.dispose();
  const reloaded = cartHost(cart);
  reloaded.render(); reloaded.fireTimers(({ delay }) => delay === 0);
  assert.deepEqual(reloaded.render().items, saved);
  assert.equal(reloaded.render().subtotal, 99000);
  reloaded.dispose();
});

test('cart: malformed persisted data is reported without displaying a phantom cart', () => {
  const browser = browserStorage(); browser.values.set('brewlite-cart-v1', '[{"toppings":"bad"}]');
  const cart = cartHost(browser); cart.render(); cart.fireTimers(({ delay }) => delay === 0);
  assert.equal(cart.render().hydrated, true);
  assert.ok(cart.render().storageError);
  assert.deepEqual(cart.render().items, []);
  cart.dispose();
});

test('checkout: topping quantities and surcharges match cart; existing order payload is preserved', async () => {
  const runtime = hookRuntime(); const host = runtime.host();
  const browser = browserStorage();
  const item = { id: 'cart-1', productId: product.id, productName: product.name, basePrice: 29000,
    size: 'L', sizePriceAdjustment: 5000, toppings: [pearls, foam], quantity: 2 };
  const requests = [];
  const load = loadFrontend({ mocks: {
    react: runtime.react,
    '@/context/useCart': { useCart: () => ({ hydrated: true, items: [item], itemCount: 2, subtotal: 116000, clearCart() {} }) },
  }, globals: { window: browser.window, localStorage: browser.window.localStorage, fetch: async (url, options) => {
    requests.push({ url, options });
    return Response.json({ id: 'order-test-only', totalAmount: 116000 });
  } } });
  const Checkout = load('src/components/checkout/CheckoutPageClient.tsx').default;
  let tree = host.render(Checkout);
  const html = markup(tree);
  assert.match(html, /Trân châu đen x<!-- -->2|Trân châu đen x2/);
  assert.match(html, /14\.000/);
  assert.match(html, /24\.000/);
  assert.match(html, /48\.000/);
  assert.match(html, /116\.000/);
  const nodes = elements(tree);
  nodes.find((element) => element.props.id === 'customerName').props.onChange({ target: { value: 'Test only' } });
  nodes.find((element) => element.props.id === 'customerPhone').props.onChange({ target: { value: '0900000000' } });
  nodes.filter((element) => element.type === 'input' && element.props.name === 'paymentMethod')[1].props.onChange();
  tree = host.render(Checkout);
  await elements(tree).find((element) => element.type === 'form').props.onSubmit({ preventDefault() {} });
  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, 'https://api.example.test/orders');
  const payload = JSON.parse(requests[0].options.body);
  assert.deepEqual(payload.items, [{ productId: product.id, productName: product.name, unitPrice: 58000,
    quantity: 2, size: 'L', toppings: 'Trân châu đen x2, Kem cheese', itemTotal: 116000 }]);
  assert.equal('userId' in payload, false);
  host.dispose();
});
