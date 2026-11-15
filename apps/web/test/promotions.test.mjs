import { afterEach, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';

// Load production TypeScript with the existing test runner, including CI Node 20.
const source = readFileSync(new URL('../src/lib/promotions.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
}).outputText;
const { requestPromotionQuote } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);

const componentPath = fileURLToPath(new URL('../src/components/checkout/PromotionCodeField.tsx', import.meta.url));
const componentSource = ts.transpileModule(readFileSync(componentPath, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
const componentModule = { exports: {} };
new Function('require', 'module', 'exports', componentSource)(
  createRequire(componentPath), componentModule, componentModule.exports,
);
const PromotionCodeField = componentModule.exports.default;

const quote = { valid: true, code: 'BREW10', subtotalAmount: 60000, discountAmount: 6000, totalAmount: 54000 };

describe('Promotion API client', () => {
  const originalFetch = globalThis.fetch;
  let calls;
  beforeEach(() => {
    calls = [];
    globalThis.fetch = async (...args) => {
      calls.push(args);
      return Response.json(quote);
    };
  });
  afterEach(() => { globalThis.fetch = originalFetch; });

  it('UT-WEB-PROMO-01: sends the code and current subtotal and uses the returned monetary values', async () => {
    const controller = new AbortController();
    const result = await requestPromotionQuote('http://localhost:3001/', '  brew10  ', 60000, controller.signal);
    assert.deepEqual(result, quote);
    assert.equal(calls[0][0], 'http://localhost:3001/promotions/validate');
    assert.deepEqual(JSON.parse(calls[0][1].body), { code: 'brew10', subtotalAmount: 60000 });
    assert.equal(calls[0][1].signal, controller.signal);
  });

  it('UT-WEB-PROMO-02: rejects empty input without sending a request', async () => {
    await assert.rejects(requestPromotionQuote('http://localhost:3001', '  ', 60000), /Vui lòng nhập mã/);
    assert.equal(calls.length, 0);
  });

  it('UT-WEB-PROMO-03: preserves the backend reason for invalid or expired codes', async () => {
    globalThis.fetch = async () => Response.json({ message: 'Mã giảm giá đã hết hạn.' }, { status: 400 });
    await assert.rejects(requestPromotionQuote('http://localhost:3001', 'BREW10', 60000), /đã hết hạn/);
    globalThis.fetch = async () => Response.json({ message: ['Mã không hợp lệ.', 'Kiểm tra lại mã.'] }, { status: 400 });
    await assert.rejects(requestPromotionQuote('http://localhost:3001', 'BREW10', 60000), /Mã không hợp lệ\. Kiểm tra lại mã\./);
  });

  it('UT-WEB-PROMO-04: gives a readable fallback when an error response is not JSON', async () => {
    globalThis.fetch = async () => new Response('<html>Unavailable</html>', { status: 503 });
    await assert.rejects(requestPromotionQuote('http://localhost:3001', 'BREW10', 60000), /Không thể áp dụng mã giảm giá/);
  });

  for (const invalid of [
    null,
    { ...quote, valid: false },
    { ...quote, code: '' },
    { ...quote, subtotalAmount: 70000 },
    { ...quote, discountAmount: -6000 },
    { ...quote, discountAmount: '6000' },
    { ...quote, totalAmount: 1 },
    { ...quote, discountAmount: 70000, totalAmount: -10000 },
  ]) {
    it(`UT-WEB-PROMO-05: refuses an invalid monetary quote (${JSON.stringify(invalid)})`, async () => {
      globalThis.fetch = async () => Response.json(invalid);
      await assert.rejects(requestPromotionQuote('http://localhost:3001', 'BREW10', 60000), /Không thể xác nhận số tiền giảm/);
    });
  }

  it('UT-WEB-PROMO-06: accepts a complete discount with zero remaining payment', async () => {
    globalThis.fetch = async () => Response.json({ ...quote, discountAmount: 60000, totalAmount: 0 });
    const result = await requestPromotionQuote('http://localhost:3001', 'BREW10', 60000);
    assert.equal(result.totalAmount, 0);
  });

  it('UT-WEB-PROMO-07: forwards cancellation so removed or replaced codes can cancel pending requests', async () => {
    globalThis.fetch = async (_url, { signal }) => { signal.throwIfAborted(); };
    const controller = new AbortController();
    controller.abort();
    await assert.rejects(requestPromotionQuote('http://localhost:3001', 'BREW10', 60000, controller.signal), { name: 'AbortError' });
  });
});

describe('Promotion input accessibility and form integration', () => {
  const props = { code: '', applying: false, disabled: false, onCodeChange() {}, onApply() {}, onRemove() {} };
  const render = (overrides) => renderToStaticMarkup(createElement(PromotionCodeField, { ...props, ...overrides }));

  it('UT-WEB-PROMO-08: labels the input and keeps coupon actions separate from order submission', () => {
    const html = render({ code: 'BREW10' });
    assert.match(html, /for="promotionCode"/);
    assert.match(html, /id="promotionCode"/);
    const buttons = html.match(/<button\b[^>]*>/g);
    assert.ok(buttons.length > 0);
    assert.ok(buttons.every((button) => button.includes('type="button"')));
  });

  it('UT-WEB-PROMO-09: exposes validation errors to assistive technology', () => {
    const html = render({ code: 'EXPIRED', error: 'Mã giảm giá đã hết hạn.' });
    assert.match(html, /aria-invalid="true"/);
    assert.match(html, /role="alert"/);
    assert.match(html, /Mã giảm giá đã hết hạn\./);
  });

  it('UT-WEB-PROMO-10: announces an applied code and offers removal', () => {
    const html = render({ code: 'BREW10', appliedCode: 'BREW10' });
    assert.match(html, /Đã áp dụng mã BREW10/);
    assert.match(html, /aria-label="Gỡ mã BREW10"/);
    assert.match(html, /role="status"/);
  });

  it('UT-WEB-PROMO-11: communicates loading and cart changes', () => {
    const loading = render({ code: 'BREW10', applying: true });
    assert.match(loading, /aria-busy="true"/);
    assert.match(loading, /Đang kiểm tra/);
    const changed = render({ code: 'BREW10', notice: 'Giỏ hàng đã thay đổi. Vui lòng áp dụng lại mã.' });
    assert.match(changed, /Vui lòng áp dụng lại mã/);
    assert.doesNotMatch(changed, /Đã áp dụng mã/);
  });
});
