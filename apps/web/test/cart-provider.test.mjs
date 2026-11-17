import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import React from 'react';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const compile = (path) => ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020,
    jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
}).outputText;
const providerCode = compile('../src/context/CartContext.tsx');
const pricingModule = { exports: {} };
new Function('require', 'module', 'exports', compile('../src/types/cart.ts'))(
  require, pricingModule, pricingModule.exports,
);
const storageKey = 'brewlite-cart-v1';
const product = { id: 'coffee', name: 'Coffee', description: 'Milk coffee', price: 35000,
  imageUrl: '/coffee.svg', categoryName: 'Cà phê', stock: 10 };
const input = { product, size: 'L', sizePriceAdjustment: 5000, quantity: 2,
  toppings: [{ id: 'pearls', name: 'Trân châu đen', unitPrice: 7000, quantity: 2 }] };

// Run CartProvider itself; only React scheduling, browser storage and timers are controlled.
function cartHost(t, savedItems) {
  const slots = [], effects = [], timers = new Map();
  const storage = new Map(savedItems ? [[storageKey, JSON.stringify(savedItems)]] : []);
  let cursor = 0, timerId = 0;
  const clock = {
    setTimeout(callback) { timers.set(++timerId, callback); return timerId; },
    clearTimeout(id) { timers.delete(id); },
  };
  const browser = { ...clock, localStorage: {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
  } };
  const hooks = {
    useState(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial;
      return [slots[index], (value) => { slots[index] = typeof value === 'function' ? value(slots[index]) : value; }];
    },
    useRef(initial) { const index = cursor++; return slots[index] ??= { current: initial }; },
    useCallback: (callback) => callback,
    useMemo: (callback) => callback(),
    useEffect(callback, dependencies) {
      const index = cursor++, previous = slots[index];
      if (!previous || dependencies.some((value, i) => value !== previous.dependencies[i])) {
        effects.push(() => {
          previous?.cleanup?.();
          slots[index] = { dependencies, cleanup: callback() };
        });
      }
    },
  };
  const context = React.createContext(null);
  const loaded = { exports: {} };
  new Function('require', 'module', 'exports', 'window', 'setTimeout', 'clearTimeout', providerCode)(
    (name) => {
      if (name === 'react') return hooks;
      if (name === './CartStore') return { CartContext: context };
      if (name === '@/types/cart') return pricingModule.exports;
      if (name === '@/components/cart/FloatingCartButton') return () => null;
      return require(name);
    }, loaded, loaded.exports, browser, clock.setTimeout, clock.clearTimeout,
  );
  t.after(() => {
    for (const slot of slots) slot?.cleanup?.();
    assert.equal(timers.size, 0);
  });
  const render = () => {
    cursor = 0;
    const tree = loaded.exports.CartProvider({ children: null });
    for (const effect of effects.splice(0)) effect();
    return tree.props.value;
  };
  render();
  for (const [id, callback] of [...timers]) { timers.delete(id); callback(); }
  return { render, storage };
}

test('UT-CART-01: adds the selected product, size, toppings and quantity with the correct subtotal (FR-04)', (t) => {
  const host = cartHost(t);
  assert.equal(host.render().hydrated, true);
  host.render().addItem(input);
  const cart = host.render();
  assert.equal(cart.items.length, 1);
  assert.ok(cart.items[0].id);
  assert.deepEqual(cart.items[0], {
    id: cart.items[0].id, productId: product.id, productName: product.name,
    description: product.description, imageUrl: product.imageUrl, categoryName: product.categoryName,
    basePrice: 35000, size: 'L', sizePriceAdjustment: 5000,
    toppings: input.toppings, quantity: 2, stock: 10,
  });
  assert.equal(cart.itemCount, 2);
  assert.equal(cart.subtotal, 108000);
  assert.deepEqual(JSON.parse(host.storage.get(storageKey)), cart.items);
});

test('UT-CART-01: merges identical options and keeps different sizes or topping quantities separate', (t) => {
  const host = cartHost(t);
  host.render().addItem(input);
  host.render().addItem({ ...input, quantity: 1 });
  assert.equal(host.render().items.length, 1);
  assert.equal(host.render().items[0].quantity, 3);
  host.render().addItem({ ...input, size: 'M', sizePriceAdjustment: 0, quantity: 1 });
  host.render().addItem({ ...input, quantity: 1, toppings: [{ ...input.toppings[0], quantity: 1 }] });
  assert.equal(host.render().items.length, 3);
  assert.equal(host.render().itemCount, 5);
  assert.equal(host.render().subtotal, 258000);
});

test('UT-CART-02: updates quantity and recalculates totals while respecting 1 and stock limits (FR-05)', (t) => {
  const host = cartHost(t);
  host.render().addItem(input);
  const id = host.render().items[0].id;
  for (const [quantity, expected] of [[3, 3], [0, 1], [-2, 1], [11, 10]]) {
    host.render().updateQuantity(id, quantity);
    const cart = host.render();
    assert.equal(cart.items[0].quantity, expected);
    assert.equal(cart.itemCount, expected);
    assert.equal(cart.subtotal, 54000 * expected);
    assert.deepEqual(JSON.parse(host.storage.get(storageKey)), cart.items);
  }
});

test('UT-CART-03: removes only the selected line and reduces the subtotal to zero after the last removal (FR-06)', (t) => {
  const host = cartHost(t);
  host.render().addItem(input);
  host.render().addItem({ ...input, size: 'M', sizePriceAdjustment: 0, quantity: 1, toppings: [] });
  const [first, remaining] = host.render().items;
  host.render().removeItem(first.id);
  assert.deepEqual(host.render().items, [remaining]);
  assert.equal(host.render().itemCount, 1);
  assert.equal(host.render().subtotal, 35000);
  host.render().removeItem(remaining.id);
  assert.deepEqual(host.render().items, []);
  assert.equal(host.render().itemCount, 0);
  assert.equal(host.render().subtotal, 0);
  assert.deepEqual(JSON.parse(host.storage.get(storageKey)), []);
});

test('cart reload restores persisted options and totals, and clearCart persists an empty cart', (t) => {
  const first = cartHost(t);
  first.render().addItem(input);
  const restored = cartHost(t, JSON.parse(first.storage.get(storageKey)));
  assert.deepEqual(restored.render().items, first.render().items);
  assert.equal(restored.render().subtotal, 108000);
  restored.render().clearCart();
  assert.equal(restored.render().itemCount, 0);
  assert.equal(restored.render().subtotal, 0);
  assert.deepEqual(JSON.parse(restored.storage.get(storageKey)), []);
});
