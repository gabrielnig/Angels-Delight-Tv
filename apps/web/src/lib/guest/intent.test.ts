import { describe, expect, it } from 'vitest';
import {
  GUEST_INTENT_KEY,
  GUEST_INTENT_MAX_AGE_MS,
  clearIntent,
  saveIntent,
  takeIntent,
} from './intent';

function memory() {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
    data,
  };
}

describe('guest intent', () => {
  it('keeps one intent and hands it back once', () => {
    const store = memory();
    saveIntent(store, { kind: 'my-list', itemKey: 'video:a' }, 1000);
    expect(takeIntent(store, ['my-list'], 2000)).toEqual({ kind: 'my-list', itemKey: 'video:a' });
    expect(takeIntent(store, ['my-list'], 2000)).toBeNull();
  });

  it('a newer intent replaces the older one', () => {
    const store = memory();
    saveIntent(store, { kind: 'my-list', itemKey: 'video:a' }, 1000);
    saveIntent(store, { kind: 'my-list', itemKey: 'series:b' }, 1500);
    expect(takeIntent(store, ['my-list'], 2000)?.itemKey).toBe('series:b');
  });

  it('forgets an intent older than the maximum age', () => {
    const store = memory();
    saveIntent(store, { kind: 'my-list', itemKey: 'video:a' }, 0);
    expect(takeIntent(store, ['my-list'], GUEST_INTENT_MAX_AGE_MS + 1)).toBeNull();
    expect(store.data.has(GUEST_INTENT_KEY)).toBe(false);
  });

  it('leaves an intent of another kind for the code that owns it', () => {
    const store = memory();
    saveIntent(store, { kind: 'like', itemKey: 'video:a' }, 1000);
    expect(takeIntent(store, ['my-list'], 2000)).toBeNull();
    expect(takeIntent(store, ['like'], 2000)).toEqual({ kind: 'like', itemKey: 'video:a' });
  });

  it('carries the chosen rating value of a like', () => {
    const store = memory();
    saveIntent(store, { kind: 'like', itemKey: 'video:a', value: 2 }, 1000);
    expect(takeIntent(store, ['like'], 2000)).toEqual({ kind: 'like', itemKey: 'video:a', value: 2 });
  });

  it('drops a value that is not a rating', () => {
    const store = memory();
    store.setItem(
      GUEST_INTENT_KEY,
      '{"v":1,"kind":"like","itemKey":"video:a","value":9,"t":1000}',
    );
    expect(takeIntent(store, ['like'], 2000)).toEqual({ kind: 'like', itemKey: 'video:a' });
  });

  it.each([
    'not json',
    '{"v":2}',
    '{"v":1,"kind":"my-list","itemKey":"nonsense","t":1}',
    '{"v":1,"kind":"delete-all","itemKey":"video:a","t":1}',
    '{"v":1,"kind":"my-list","itemKey":"video:a","t":"x"}',
  ])('ignores and clears a damaged value %s', (raw) => {
    const store = memory();
    store.setItem(GUEST_INTENT_KEY, raw);
    expect(takeIntent(store, ['my-list'], 10)).toBeNull();
    expect(store.data.has(GUEST_INTENT_KEY)).toBe(false);
  });

  it('never throws when storage is missing or broken', () => {
    expect(() => saveIntent(null, { kind: 'my-list', itemKey: 'video:a' })).not.toThrow();
    expect(takeIntent(null, ['my-list'])).toBeNull();
    const broken = {
      getItem: () => {
        throw new Error('x');
      },
      setItem: () => {
        throw new Error('x');
      },
      removeItem: () => {
        throw new Error('x');
      },
    };
    expect(() => saveIntent(broken, { kind: 'my-list', itemKey: 'video:a' })).not.toThrow();
    expect(takeIntent(broken, ['my-list'])).toBeNull();
    expect(() => clearIntent(broken)).not.toThrow();
  });
});
