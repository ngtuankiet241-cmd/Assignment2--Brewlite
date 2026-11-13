import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as crypto from 'node:crypto';
import ts from 'typescript';
import React from 'react';

const require = createRequire(import.meta.url);
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const Link = ({ children, ...props }) => React.createElement('a', props, children);

// Load production TS/TSX with only browser/network dependencies substituted.
export function loadFrontend({ mocks = {}, globals = {} } = {}) {
  const cache = new Map();
  function load(path) {
    const filename = resolve(root, path);
    if (cache.has(filename)) return cache.get(filename).exports;
    const loaded = { exports: {} };
    cache.set(filename, loaded);
    const code = ts.transpileModule(readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
    }).outputText;
    const localRequire = (name) => {
      if (name in mocks) return mocks[name];
      if (name === 'next/link') return { __esModule: true, default: Link };
      if (name.startsWith('@/') || name.startsWith('.')) {
        const base = name.startsWith('@/') ? resolve(root, 'src', name.slice(2)) : resolve(dirname(filename), name);
        const dependency = [base, `${base}.ts`, `${base}.tsx`].find(existsSync);
        if (dependency) return load(dependency);
      }
      return require(name);
    };
    const scope = {
      fetch, process: { env: { NEXT_PUBLIC_API_URL: 'https://api.example.test' } },
      crypto, setTimeout, clearTimeout, ...globals,
    };
    new Function('require', 'module', 'exports', ...Object.keys(scope), code)(
      localRequire, loaded, loaded.exports, ...Object.values(scope),
    );
    return loaded.exports;
  }
  return load;
}

export function browserStorage() {
  const values = new Map();
  const events = new EventTarget();
  const timers = new Map();
  let nextTimer = 0;
  const window = {
    localStorage: {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
      removeItem: (key) => values.delete(key),
    },
    addEventListener: events.addEventListener.bind(events),
    removeEventListener: events.removeEventListener.bind(events),
    dispatchEvent: events.dispatchEvent.bind(events),
    setTimeout: (callback, delay) => { timers.set(++nextTimer, { callback, delay }); return nextTimer; },
    clearTimeout: (id) => timers.delete(id),
  };
  return {
    window, values, timers,
    fireTimers(predicate = () => true) {
      for (const [id, timer] of [...timers]) {
        if (predicate(timer)) { timers.delete(id); timer.callback(); }
      }
    },
  };
}

// A small lifecycle driver: tests exercise real component callbacks and effects.
// Separate hosts model React's keyed child remounts without adding a DOM library.
export function hookRuntime() {
  let active;
  const react = { ...React };
  for (const name of ['useState', 'useRef', 'useEffect', 'useMemo', 'useCallback', 'useSyncExternalStore']) {
    react[name] = (...args) => active[name](...args);
  }
  function host() {
    const slots = [];
    let cursor = 0;
    let effects = [];
    const hooks = {
      useState(initial) {
        const slot = slots[cursor++] ??= { value: typeof initial === 'function' ? initial() : initial };
        return [slot.value, (next) => { slot.value = typeof next === 'function' ? next(slot.value) : next; }];
      },
      useRef(initial) { return slots[cursor++] ??= { current: initial }; },
      useMemo(callback) { return callback(); },
      useCallback(callback) { return callback; },
      useEffect(callback, deps) {
        const slot = slots[cursor++] ??= {};
        if (!slot.deps || deps.some((value, index) => value !== slot.deps[index])) {
          slot.deps = deps;
          effects.push(() => { slot.cleanup?.(); slot.cleanup = callback(); });
        }
      },
      useSyncExternalStore(subscribe, getSnapshot) {
        hooks.useEffect(() => subscribe(() => {}), [subscribe]);
        return getSnapshot();
      },
    };
    return {
      render(component, props = {}) {
        const previous = active;
        active = hooks;
        cursor = 0;
        try {
          const result = component(props);
          const pending = effects; effects = [];
          pending.forEach((effect) => effect());
          return result;
        } finally { active = previous; }
      },
      dispose() { slots.forEach((slot) => slot.cleanup?.()); },
    };
  }
  return { react, host };
}

export function elements(tree) {
  if (Array.isArray(tree)) return tree.flatMap(elements);
  if (!React.isValidElement(tree)) return [];
  return [tree, ...elements(tree.props.children)];
}

export const tick = () => new Promise((done) => setImmediate(done));
