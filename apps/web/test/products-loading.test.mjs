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
const product = { id: 'db-123', name: 'Latte', description: 'Coffee', price: 39000, stock: 4, imageUrl: '/latte.svg' };
const tick = () => new Promise((done) => setImmediate(done));
const json = (body, status = 200) => Response.json(body, { status });

// Execute the actual TS/TSX modules without adding a test runner dependency.
function loader(overrides = {}) {
  const cache = new Map();
  function load(path) {
    const filename = resolve(root, path);
    if (cache.has(filename)) return cache.get(filename).exports;
    const loadedModule = { exports: {} };
    cache.set(filename, loadedModule);
    const code = ts.transpileModule(readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
    }).outputText;
    const localRequire = (name) => {
      if (name === '@/context/useCart' && overrides.cart) return { useCart: () => overrides.cart };
      if (name === 'react' && overrides.react &&
        (filename.endsWith('useProducts.ts') || filename.endsWith('ProductImage.tsx'))) return overrides.react;
      // Only isolate unrelated cart/modal/image dependencies when rendering the grid.
      if (name === './ProductConfigurator' || name === './ProductCard') {
        return { __esModule: true, default: ({ product }) => React.createElement('article', null, product?.name) };
      }
      if (name.startsWith('@/') || name.startsWith('.')) {
        const base = name.startsWith('@/') ? resolve(root, 'src', name.slice(2)) : resolve(dirname(filename), name);
        const dependency = [base, `${base}.ts`, `${base}.tsx`].find(existsSync);
        if (dependency) return load(dependency);
      }
      return require(name);
    };
    new Function('require', 'module', 'exports', 'fetch', 'process', 'setTimeout', 'clearTimeout', code)(
      localRequire, loadedModule, loadedModule.exports, overrides.fetch ?? fetch,
      { env: { NODE_ENV: overrides.env ?? 'development', NEXT_PUBLIC_API_URL: 'https://configured.example' } },
      overrides.setTimeout ?? setTimeout, overrides.clearTimeout ?? clearTimeout,
    );
    return loadedModule.exports;
  }
  return load;
}

function timers() {
  const pending = new Map();
  let nextId = 0;
  return {
    setTimeout: (callback, delay) => { pending.set(++nextId, { callback, delay }); return nextId; },
    clearTimeout: (id) => pending.delete(id),
    fire: () => { for (const { callback } of [...pending.values()]) callback(); },
    pending,
  };
}

function hookHost(fetcher, env = 'development') {
  const states = [];
  let cursor = 0;
  let previousDependencies;
  let pendingEffect;
  let cleanup;
  const clock = timers();
  const react = {
    useState(initial) {
      const index = cursor++;
      if (!(index in states)) states[index] = initial;
      return [states[index], (value) => { states[index] = typeof value === 'function' ? value(states[index]) : value; }];
    },
    useMemo: (callback) => callback(),
    useCallback: (callback) => callback,
    useEffect(callback, dependencies) {
      if (!previousDependencies || dependencies.some((value, i) => value !== previousDependencies[i])) {
        previousDependencies = dependencies;
        pendingEffect = callback;
      }
    },
  };
  const { useProducts: runProductsHook } = loader({ react, fetch: fetcher, env, ...clock })('src/hooks/useProducts.ts');
  return {
    clock,
    render() {
      cursor = 0;
      const view = runProductsHook();
      if (pendingEffect) {
        cleanup?.();
        const effect = pendingEffect;
        pendingEffect = undefined;
        cleanup = effect();
      }
      return view;
    },
    dispose: () => cleanup?.(),
  };
}

const abortable = (_url, { signal }) => new Promise((_, reject) => {
  signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true });
});

test('slow API stays loading without products, then renders API data immediately', async () => {
  let respond;
  const host = hookHost(() => new Promise((done) => { respond = done; }));
  assert.equal(host.render().loading, true);
  assert.deepEqual(host.render().products, []);
  respond(json({ success: true, data: [product] }));
  await tick();
  const view = host.render();
  assert.equal(view.loading, false);
  assert.equal(view.error, null);
  assert.equal(view.products[0].id, product.id);
  assert.equal(view.products[0].price, product.price);
  assert.equal(host.clock.pending.size, 0);
  host.dispose();
});

test('broken catalog image URLs use existing local SVGs without changing API data', async () => {
  const images = [
    ['photo-1558857563-c0c6b8b7a1d9', 'tra-sua.svg'],
    ['photo-1536256268855-8f64b7c2b9e7', 'matcha.svg'],
    ['photo-1579954115545-a955e57f8c1f', 'oreo-da-xay.svg'],
  ];
  for (const [photo, filename] of images) {
    const original = { ...product, imageUrl: `https://images.unsplash.com/${photo}` };
    const host = hookHost(async () => json([original]));
    host.render(); await tick();
    const result = host.render().products[0];
    assert.equal(result.imageUrl, `/images/products/${filename}`);
    assert.deepEqual({ ...result, imageUrl: original.imageUrl }, {
      ...original, category: 'espresso', categoryName: 'Cà phê pha máy', isAvailable: true,
    });
    assert.equal(original.imageUrl, `https://images.unsplash.com/${photo}`);
    assert.match(readFileSync(resolve(root, 'public', result.imageUrl.slice(1)), 'utf8'), /<svg[\s>]/);
    host.dispose();
  }
});

test('image resolver preserves other sources and handles missing or invalid URLs', () => {
  const { resolveProductImage, PRODUCT_IMAGE_FALLBACK } = loader()('src/lib/productImage.ts');
  for (const value of ['', ' ', 'broken.jpg', 'https://', '//example.com/image.jpg', 'data:image/png;base64,xxx']) {
    assert.equal(resolveProductImage(value), PRODUCT_IMAGE_FALLBACK);
  }
  for (const value of ['/images/products/ca-phe-sua.svg', 'https://example.com/new-product.jpg']) {
    assert.equal(resolveProductImage(value), value);
  }
  assert.ok(existsSync(resolve(root, 'public', PRODUCT_IMAGE_FALLBACK.slice(1))));
});

test('image failures use local then inline fallback without a loop and preserve sizing and styles', () => {
  let attempt = 0;
  const ProductImage = loader({ react: { useState: () => [attempt, (value) => { attempt = value; }] } })(
    'src/components/menu/ProductImage.tsx',
  ).default;
  const props = { src: 'https://example.com/unavailable.jpg', alt: 'Drink', fill: true,
    sizes: '96px', className: 'object-contain p-2' };
  const outer = ProductImage(props);
  let image = outer.type(outer.props);
  assert.equal(image.props.src, props.src);
  image.props.onError();
  image = outer.type(outer.props);
  assert.equal(image.props.src, '/images/products/placeholder.svg');
  image.props.onError();
  image = outer.type(outer.props);
  assert.match(image.props.src, /^data:image\/svg\+xml,/);
  assert.equal(image.props.onError, undefined);
  for (const key of ['alt', 'fill', 'sizes', 'className']) assert.equal(image.props[key], props[key]);
  assert.notEqual(ProductImage({ ...props, src: '/images/products/matcha.svg' }).key, outer.key);
  attempt = 0;
  const missing = ProductImage({ ...props, src: '' });
  image = missing.type(missing.props);
  assert.equal(image.props.src, '/images/products/placeholder.svg');
  image.props.onError();
  image = missing.type(missing.props);
  assert.match(image.props.src, /^data:image\/svg\+xml,/);
  assert.equal(image.props.onError, undefined);
});

const catalogImages = [
  ['cmwfaunf10000jxr9zoh6x322', 'photo-1461023058943-07fcbe16d735', 'ca-phe-sua.svg'],
  ['cmwfaunj30001jxr9elvss1oc', 'photo-1558857563-c0c6b8b7a1d9', 'tra-sua.svg'],
  ['cmwfaunli0002jxr9pjwdtmvp', 'photo-1536256268855-8f64b7c2b9e7', 'matcha.svg'],
  ['cmwfaunob0003jxr95mxw1k05', 'photo-1556679343-c7306c1976bc', 'tra-dao.svg'],
  ['cmwfaunxu0004jxr9gawwxuh7', 'photo-1576092768241-dec231879fc3', 'hong-tra.svg'],
  ['cmwfauo0q0005jxr9tygbwyjn', 'photo-1579954115545-a955e57f8c1f', 'oreo-da-xay.svg'],
];

test('all six production IDs select unique local images regardless of display name or stored source', async () => {
  const originals = catalogImages.map(([id]) => ({ ...product, id, name: 'Renamed drink',
    imageUrl: '/images/products/ca-phe-den.svg' }));
  const host = hookHost(async () => json(originals));
  host.render(); await tick();
  const result = host.render().products;
  assert.deepEqual(result.map(p => p.imageUrl), catalogImages.map(([, , file]) => `/images/products/${file}`));
  assert.equal(new Set(result.map(p => p.imageUrl)).size, originals.length);
  result.forEach((p, i) => {
    assert.deepEqual({ ...p, imageUrl: originals[i].imageUrl }, {
      ...originals[i], category: 'traditional', categoryName: 'Cà phê truyền thống', isAvailable: true,
    });
    assert.ok(existsSync(resolve(root, 'public', p.imageUrl.slice(1))));
  });
  host.dispose();
});

test('legacy URLs including query variants resolve in other environments and all existing SVG paths stay distinct', () => {
  const { resolveProductImage } = loader()('src/lib/productImage.ts');
  for (const [, photo, file] of catalogImages) {
    assert.equal(resolveProductImage(`https://images.unsplash.com/${photo}?w=400&auto=format#image`, 'other-db-id'),
      `/images/products/${file}`);
  }
  const files = ['americano', 'bac-xiu', 'ca-phe-den', 'ca-phe-sua', 'cappuccino', 'matcha', 'oreo-da-xay', 'tra-dao', 'tra-sua'];
  for (const file of files) {
    const path = `/images/products/${file}.svg`;
    assert.equal(resolveProductImage(path, 'other-db-id'), path);
    assert.match(readFileSync(resolve(root, 'public', path.slice(1)), 'utf8'), /<svg[\s>]/);
  }
  assert.notEqual(resolveProductImage('/images/products/ca-phe-sua.svg'), resolveProductImage('/images/products/ca-phe-den.svg'));
});

test('old cart image snapshots resolve to the same local images as menu and details without changing cart data', () => {
  const items = catalogImages.map(([productId, photo], i) => ({
    id: `line-${i}`, productId, productName: 'Renamed drink', description: 'Drink',
    imageUrl: `https://images.unsplash.com/${photo}`, categoryName: 'Drinks',
    basePrice: 39000, size: 'M', sizePriceAdjustment: 0, toppings: [], quantity: 2, stock: 4,
  }));
  const before = structuredClone(items);
  const cart = { items, itemCount: 12, subtotal: 468000, hydrated: true, storageError: null,
    updateQuantity() {}, removeItem() {} };
  const CartPage = loader({ cart })('src/components/cart/CartPageClient.tsx').default;
  const html = renderToStaticMarkup(React.createElement(CartPage));
  for (const [, , file] of catalogImages) assert.ok(html.includes(`src="/images/products/${file}"`));
  assert.doesNotMatch(html, /images\.unsplash\.com|src="[^\"]*placeholder/);
  assert.match(html, /object-contain p-2/);
  assert.deepEqual(items, before);
});

test('empty API is distinct from a search/category with no results; reset does not refetch', async () => {
  let calls = 0;
  const host = hookHost(async () => { calls++; return json([product]); });
  host.render(); await tick();
  host.render().setSearchQuery('missing drink');
  assert.equal(host.render().products.length, 0);
  assert.equal(host.render().isCatalogEmpty, false);
  host.render().resetFilters();
  assert.equal(host.render().products.length, 1);
  host.render().setSelectedCategory('tea');
  assert.equal(host.render().products.length, 0);
  assert.equal(host.render().isCatalogEmpty, false);
  assert.equal(calls, 1);
  host.dispose();
  const empty = hookHost(async () => json({ success: true, data: [] }));
  empty.render(); await tick();
  empty.render().setSearchQuery('anything');
  assert.equal(empty.render().isCatalogEmpty, true);
  assert.equal(empty.render().loading, false);
  assert.equal(empty.render().error, null);
  empty.dispose();
});

for (const [label, fetcher] of [
  ['HTTP 500', async () => json({}, 500)],
  ['invalid JSON', async () => new Response('<html>error</html>')],
  ['invalid envelope', async () => json({ products: [] })],
  ['invalid product', async () => json([{ ...product, price: 'free' }])],
  ['legacy HTTP 200 mock data', async () => json([{
    id: 'legacy', name: 'Coffee', description: 'Coffee', price: 25000, imageUrl: '/coffee.svg',
  }])],
  ['network failure', async () => { throw new TypeError('Failed to fetch'); }],
]) {
  test(`${label} ends loading with Error and no mock products`, async () => {
    const host = hookHost(fetcher);
    host.render(); await tick();
    const view = host.render();
    assert.equal(view.loading, false);
    assert.ok(view.error);
    assert.deepEqual(view.products, []);
    host.dispose();
  });

}

test('configuration parser accepts database-backed options and rejects malformed prices', () => {
  const { parseProductConfiguration } = loader()('src/lib/productConfiguration.ts');
  const configuration = {
    success: true,
    data: {
      sizes: [{ id: 'L', label: 'Lớn', priceAdjustment: 6500 }],
      toppings: [{ id: 'pearls', name: 'Trân châu đen', unitPrice: 7500 }],
    },
  };
  assert.deepEqual(parseProductConfiguration(configuration), configuration.data);
  assert.throws(() => parseProductConfiguration({
    success: true,
    data: { sizes: [{ id: 'L', label: 'Lớn', priceAdjustment: '6500' }], toppings: [] },
  }), /kích cỡ/);
});

test('configuration proxy validates and forwards database options without caching', async () => {
  const clock = timers();
  const configuration = {
    success: true,
    data: { sizes: [{ id: 'M', label: 'Vừa', priceAdjustment: 0 }], toppings: [] },
  };
  const { GET } = loader({ ...clock, fetch: async (url) => {
    assert.equal(url, 'https://configured.example/products/configuration');
    return json(configuration);
  } })('src/app/api/products/configuration/route.ts');
  const response = await GET();
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await response.json(), configuration);
  assert.equal(clock.pending.size, 0);
});

test('client timeout ends loading and retry after recovery succeeds', async () => {
  let recovered = false;
  const host = hookHost((...args) => recovered ? Promise.resolve(json([product])) : abortable(...args));
  host.render();
  assert.equal([...host.clock.pending.values()][0].delay, 10000);
  host.clock.fire(); await tick();
  assert.match(host.render().error, /quá lâu/);
  assert.equal(host.render().loading, false);
  recovered = true;
  host.render().refetch();
  assert.equal(host.render().loading, true);
  await tick();
  assert.equal(host.render().error, null);
  assert.equal(host.render().products[0].id, product.id);
  host.dispose();
});

test('retry HTTP 500 preserves filters and clears old products on failure', async () => {
  let status = 200;
  const host = hookHost(async () => json([product], status));
  host.render(); await tick();
  host.render().setSearchQuery('latte');
  status = 500;
  host.render().refetch(); host.render(); await tick();
  assert.ok(host.render().error);
  assert.deepEqual(host.render().products, []);
  status = 200;
  host.render().refetch(); host.render(); await tick();
  assert.equal(host.render().searchQuery, 'latte');
  assert.equal(host.render().products.length, 1);
  host.dispose();
});

test('development simulations work without requests or artificial delays; retry returns to API', async () => {
  let calls = 0;
  const host = hookHost(async () => { calls++; return json([product]); });
  host.render(); await tick();
  for (const mode of ['loading', 'empty', 'error']) {
    host.render().setDemoMode(mode);
    const view = host.render();
    assert.equal(view.loading, mode === 'loading');
    assert.equal(Boolean(view.error), mode === 'error');
    assert.equal(view.products.length, 0);
    if (mode === 'empty') assert.equal(view.isCatalogEmpty, true);
    assert.equal(host.clock.pending.size, 0);
  }
  assert.equal(calls, 1);
  host.render().refetch(); host.render(); await tick();
  assert.equal(host.render().products.length, 1);
  assert.equal(calls, 2);
  host.dispose();
});

test('production ignores simulation requests', async () => {
  const host = hookHost(async () => json([product]), 'production');
  host.render(); await tick();
  host.render().setDemoMode('error');
  assert.equal(host.render().demoMode, 'normal');
  assert.equal(host.render().error, null);
  assert.equal(host.render().products.length, 1);
  host.dispose();
});

test('obsolete request cannot replace the latest retry result', async () => {
  let respondOld;
  let calls = 0;
  const host = hookHost(() => ++calls === 1
    ? new Promise((done) => { respondOld = done; })
    : Promise.resolve(json([product])));
  host.render();
  host.render().refetch(); host.render(); await tick();
  respondOld(json([{ ...product, id: 'stale' }])); await tick();
  assert.equal(host.render().products[0].id, product.id);
  host.dispose();
});

for (const [label, body, upstreamStatus, expectedStatus] of [
  ['array', [product], 200, 200],
  ['NestJS envelope', { success: true, data: [product] }, 200, 200],
  ['empty', [], 200, 200],
  ['HTTP 500', {}, 500, 500],
  ['invalid data', { data: [{}] }, 200, 502],
  ['failure envelope', { success: false, data: [] }, 200, 502],
  ['marked fallback', { source: 'mock', data: [product] }, 200, 502],
]) {
  test(`proxy handles ${label} without manufacturing products`, async () => {
    const clock = timers();
    const { GET } = loader({ ...clock, fetch: async (url) => {
      assert.equal(url, 'https://configured.example/products');
      return json(body, upstreamStatus);
    } })('src/app/api/products/route.ts');
    const response = await GET();
    assert.equal(response.status, expectedStatus);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    const result = await response.json();
    if (expectedStatus === 200) assert.deepEqual(result, body);
    else assert.equal(result.success, false);
    assert.equal(clock.pending.size, 0);
  });
}

test('proxy timeout returns 504 and covers reading a slow response body', async () => {
  const clock = timers();
  const { GET } = loader({ ...clock, fetch: async (_url, { signal }) => ({
    ok: true,
    json: () => abortable('', { signal }),
  }) })('src/app/api/products/route.ts');
  const pending = GET(); await tick();
  assert.equal([...clock.pending.values()][0].delay, 6000);
  clock.fire();
  const response = await pending;
  assert.equal(response.status, 504);
  assert.equal(clock.pending.size, 0);
});

test('proxy network and JSON failures return 502', async () => {
  for (const fetcher of [async () => { throw new TypeError('offline'); }, async () => new Response('bad json')]) {
    const { GET } = loader({ ...timers(), fetch: fetcher })('src/app/api/products/route.ts');
    assert.equal((await GET()).status, 502);
  }
});

test('grid renders exclusive Loading / Error / Empty / Success and hides Dev Only in production', () => {
  for (const env of ['development', 'production']) {
    const ProductGrid = loader({ env })('src/components/menu/ProductGrid.tsx').default;
    const props = { products: [product], isCatalogEmpty: false, selectedCategory: 'all', searchQuery: '',
      onSelectCategory() {}, onSearchChange() {}, onRetry() {}, onResetFilters() {},
      demoMode: 'normal', onDemoModeChange() {}, loading: false, error: null };
    const render = (extra) => renderToStaticMarkup(React.createElement(ProductGrid, { ...props, ...extra }));
    const loading = render({ loading: true });
    assert.match(loading, /aria-busy="true"/);
    assert.doesNotMatch(loading, /<article/);
    assert.doesNotMatch(loading, /role="alert"/);
    assert.match(render({ error: 'HTTP 500' }), /role="alert"/);
    assert.doesNotMatch(render({ error: 'HTTP 500' }), /<article/);
    assert.match(render({ products: [] }), /Thực đơn hiện chưa có đồ uống/);
    assert.match(render({ products: [] }), /Tải lại thực đơn/);
    assert.match(render({ products: [], isCatalogEmpty: true, searchQuery: 'missing' }), /Thực đơn hiện chưa có đồ uống/);
    assert.match(render({ products: [], searchQuery: 'missing' }), /Chưa tìm thấy đồ uống phù hợp/);
    assert.match(render({}), /<article>Latte<\/article>/);
    assert.equal(render({}).includes('Dev Only'), env === 'development');
  }
});
