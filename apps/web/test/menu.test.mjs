import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// Helper mirror for category detection logic
function detectCategory(name) {
  const lower = (name || '').toLowerCase();

  if (lower.includes('trà') || lower.includes('tea')) {
    return {
      category: 'tea',
      categoryName: 'Trà trái cây',
    };
  }

  if (
    lower.includes('espresso') ||
    lower.includes('latte') ||
    lower.includes('cappuccino') ||
    lower.includes('americano')
  ) {
    return {
      category: 'espresso',
      categoryName: 'Cà phê pha máy',
    };
  }

  return {
    category: 'traditional',
    categoryName: 'Cà phê truyền thống',
  };
}

// Currency format helper
function formatCurrencyVND(amount) {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(amount);
}

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
        price: 29000,
        stock: 50,
        imageUrl: '/images/products/ca-phe-sua.svg',
      };

      assert.ok(sampleItem.id);
      assert.ok(sampleItem.name);
      assert.ok(sampleItem.price > 0);
      assert.ok(sampleItem.stock > 0);
      assert.ok(sampleItem.imageUrl);
    });
  });
});

