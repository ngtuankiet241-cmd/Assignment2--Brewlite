import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const cache = new Map();

// Exercise exported production helpers, including useProducts' actual category rules.
function load(filename) {
  if (cache.has(filename)) return cache.get(filename).exports;
  const loaded = { exports: {} };
  cache.set(filename, loaded);
  const code = ts.transpileModule(readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  new Function('require', 'module', 'exports', code)((name) => {
    if (name.startsWith('@/') || name.startsWith('.')) {
      const base = name.startsWith('@/') ? resolve(root, 'src', name.slice(2)) : resolve(dirname(filename), name);
      return load([base, `${base}.ts`].find(existsSync));
    }
    return require(name);
  }, loaded, loaded.exports);
  return loaded.exports;
}

const { detectCategory } = load(resolve(root, 'src/hooks/useProducts.ts'));
const { formatCurrencyVND } = load(resolve(root, 'src/lib/formatCurrency.ts'));
const { parseProductsResponse } = load(resolve(root, 'src/lib/productResponse.ts'));

describe('Menu UX & Helper Specifications (Sprint 1 MVP)', () => {
  describe('detectCategory()', () => {
    it('UT-WEB-01: identifies tea category correctly', () => {
      const result = detectCategory('Trà đào cam sả');
      assert.equal(result.category, 'tea');
      assert.equal(result.categoryName, 'Trà trái cây');
    });

    it('UT-WEB-02: identifies espresso/machine brewed coffee correctly', () => {
      const cappuccino = detectCategory('Cappuccino nóng');
      assert.equal(cappuccino.category, 'espresso');
      assert.equal(cappuccino.categoryName, 'Cà phê pha máy');

      const latte = detectCategory('Caramel Latte');
      assert.equal(latte.category, 'espresso');
    });

    it('UT-WEB-03: defaults to traditional Vietnamese coffee for phin beverages', () => {
      const caPheSua = detectCategory('Cà phê sữa đá');
      assert.equal(caPheSua.category, 'traditional');
      assert.equal(caPheSua.categoryName, 'Cà phê truyền thống');

      const bacXiu = detectCategory('Bạc xỉu 3 tầng');
      assert.equal(bacXiu.category, 'traditional');
    });

    it('UT-WEB-01: keeps milk tea, blended drinks and matcha in their specific categories', () => {
      assert.equal(detectCategory('Trà sữa trân châu').category, 'milk-tea');
      assert.equal(detectCategory('Milk Tea').category, 'milk-tea');
      assert.equal(detectCategory('Matcha Latte').category, 'specialty');
      assert.equal(detectCategory('Matcha đá xay').category, 'blended');
    });
  });

  describe('formatCurrencyVND()', () => {
    it('UT-WEB-04: formats currency to standard VND string', () => {
      const formatted = formatCurrencyVND(25000);
      assert.ok(formatted.includes('25.000'));
      assert.ok(formatted.includes('₫') || formatted.includes('VND'));
    });
  });

  describe('Menu State Requirements (DoD Sprint 1)', () => {
    it('UT-WEB-05: verifies valid product structure for menu render', () => {
      const sampleItem = {
        id: 'p-1',
        name: 'Cà phê sữa',
        description: 'Cà phê phin với sữa',
        price: 29000,
        stock: 50,
        imageUrl: '/images/products/ca-phe-sua.svg',
      };

      assert.deepEqual(parseProductsResponse({ success: true, data: [sampleItem] }), [sampleItem]);
      for (const invalid of [{ id: '' }, { name: '' }, { price: -1 }, { stock: 1.5 }, { imageUrl: null }]) {
        assert.throws(() => parseProductsResponse({ success: true, data: [{ ...sampleItem, ...invalid }] }), /không hợp lệ/);
      }
    });
  });
});

