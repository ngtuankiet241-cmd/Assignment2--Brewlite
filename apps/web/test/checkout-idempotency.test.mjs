import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const source = readFileSync(new URL('../src/lib/checkout-idempotency.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
}).outputText;
const { getCheckoutAttempt, clearCheckoutAttempt } =
  await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);

function storage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => { values.set(key, value); },
    removeItem: (key) => { values.delete(key); },
  };
}

describe('Checkout retry keys', () => {
  it('reuses one key after an uncertain network result and after a page reload', () => {
    const session = storage();
    const first = getCheckoutAttempt('{"quantity":1}', null, session);
    assert.deepEqual(getCheckoutAttempt(first.request, first, session), first);
    assert.deepEqual(getCheckoutAttempt(first.request, null, session), first);
  });

  it('generates a different key when the customer changes the order', () => {
    const session = storage();
    const first = getCheckoutAttempt('{"quantity":1}', null, session);
    const changed = getCheckoutAttempt('{"quantity":2}', first, session);
    assert.notEqual(changed.key, first.key);
    assert.deepEqual(getCheckoutAttempt(changed.request, null, session), changed);
  });

  it('clears a successful checkout so a later intentional identical order gets a new key', () => {
    const session = storage();
    const first = getCheckoutAttempt('{"quantity":1}', null, session);
    clearCheckoutAttempt(session);
    assert.notEqual(getCheckoutAttempt(first.request, null, session).key, first.key);
  });

  it('keeps the in-memory key when session storage is unavailable', () => {
    const blocked = { getItem() { throw Error('Blocked'); }, setItem() { throw Error('Blocked'); }, removeItem() { throw Error('Blocked'); } };
    const first = getCheckoutAttempt('{"quantity":1}', null, blocked);
    assert.deepEqual(getCheckoutAttempt(first.request, first, blocked), first);
    assert.doesNotThrow(() => clearCheckoutAttempt(blocked));
  });
});
