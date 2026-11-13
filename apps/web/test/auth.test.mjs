import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

// Exercise the actual browser session helpers, including on the CI Node 20 runtime.
const source = readFileSync(new URL('../src/lib/auth.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
}).outputText;
const { saveAuthSession, clearAuthSession, getAuthSnapshot, parseAuthUser, subscribeAuthChanges } =
  await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);

const user = { id: 'user-1', fullName: 'Auth Test', email: 'auth@example.test' };
const token = (exp = Math.floor(Date.now() / 1000) + 3600) =>
  `${Buffer.from('{"alg":"HS256"}').toString('base64url')}.${Buffer.from(JSON.stringify({ exp })).toString('base64url')}.signature`;

describe('Browser authentication session', () => {
  let values;
  const originalWindow = globalThis.window;
  beforeEach(() => {
    values = new Map();
    const events = new EventTarget();
    globalThis.window = {
      localStorage: {
        getItem: (key) => values.get(key) ?? null,
        setItem: (key, value) => values.set(key, value),
        removeItem: (key) => values.delete(key),
      },
      addEventListener: events.addEventListener.bind(events),
      removeEventListener: events.removeEventListener.bind(events),
      dispatchEvent: events.dispatchEvent.bind(events),
      setTimeout,
      clearTimeout,
    };
  });
  afterEach(() => {
    if (originalWindow === undefined) delete globalThis.window;
    else globalThis.window = originalWindow;
  });

  it('notifies the same tab immediately after successful login', () => {
    let snapshot;
    const unsubscribe = subscribeAuthChanges(() => { snapshot = getAuthSnapshot(); });
    try {
      saveAuthSession({ accessToken: token(), user });
      assert.deepEqual(parseAuthUser(snapshot), user);
      assert.equal(values.has('token'), true);
    } finally { unsubscribe(); }
  });

  it('restores the existing session without an auth provider or page navigation', () => {
    values.set('token', token());
    values.set('user', JSON.stringify(user));
    assert.deepEqual(parseAuthUser(getAuthSnapshot()), user);
  });

  it('logs out without deleting the cart and notifies mounted consumers', () => {
    saveAuthSession({ accessToken: token(), user });
    values.set('cart', 'preserve-this-cart');
    let snapshot = getAuthSnapshot();
    const unsubscribe = subscribeAuthChanges(() => { snapshot = getAuthSnapshot(); });
    try {
      clearAuthSession();
      assert.equal(snapshot, null);
      assert.equal(values.has('token'), false);
      assert.equal(values.has('user'), false);
      assert.equal(values.get('cart'), 'preserve-this-cart');
    } finally { unsubscribe(); }
  });

  it('updates mounted consumers when another tab removes the session', () => {
    saveAuthSession({ accessToken: token(), user });
    let snapshot = getAuthSnapshot();
    const unsubscribe = subscribeAuthChanges(() => { snapshot = getAuthSnapshot(); });
    try {
      values.delete('token');
      const event = new Event('storage');
      Object.defineProperty(event, 'key', { value: 'token' });
      window.dispatchEvent(event);
      assert.equal(snapshot, null);
    } finally { unsubscribe(); }
  });

  it('does not show an authenticated user for expired or corrupted credentials', () => {
    values.set('user', JSON.stringify(user));
    for (const invalid of ['undefined', 'bad.token', token(1)]) {
      values.set('token', invalid);
      assert.equal(getAuthSnapshot(), null);
    }
    values.set('token', token());
    values.set('user', '{invalid-json');
    assert.equal(getAuthSnapshot(), null);
  });

  it('rejects an invalid API response before saving a phantom session', () => {
    assert.throws(() => saveAuthSession({ user }), /không hợp lệ/);
    assert.equal(values.size, 0);
  });

  it('handles server rendering and blocked storage safely', () => {
    delete globalThis.window;
    assert.equal(getAuthSnapshot(), null);
    globalThis.window = { dispatchEvent() {}, get localStorage() { throw new Error('Blocked'); } };
    assert.equal(getAuthSnapshot(), null);
    assert.throws(() => saveAuthSession({ accessToken: token(), user }), /Không thể lưu phiên/);
    assert.doesNotThrow(clearAuthSession);
  });
});
