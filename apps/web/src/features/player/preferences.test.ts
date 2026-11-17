import { describe, expect, it } from 'vitest';
import {
  loadPreferences,
  preferencesKey,
  savePreferences,
  type KeyValueStore,
} from './preferences';

function memory(
  initial: Record<string, string> = {},
): KeyValueStore & { data: Record<string, string> } {
  const data = { ...initial };
  return {
    data,
    getItem: (k) => data[k] ?? null,
    setItem: (k, v) => {
      data[k] = v;
    },
  };
}

describe('player preferences storage', () => {
  it('returns the defaults for a new profile, with captions on for kids', () => {
    const adult = loadPreferences(memory(), 'p1', { kids: false });
    expect(adult).toMatchObject({
      captionsOn: false,
      volume: 1,
      rate: 1,
      muted: false,
      dataSaver: false,
      autoplayNext: false,
    });
    expect(loadPreferences(memory(), 'p1', { kids: true }).captionsOn).toBe(true);
  });

  it('round trips per profile', () => {
    const store = memory();
    savePreferences(store, 'p1', {
      ...loadPreferences(store, 'p1', { kids: false }),
      volume: 0.4,
      muted: true,
      rate: 1.5,
    });
    expect(loadPreferences(store, 'p1', { kids: false })).toMatchObject({
      volume: 0.4,
      muted: true,
      rate: 1.5,
    });
    expect(loadPreferences(store, 'p2', { kids: false })).toMatchObject({
      volume: 1,
      muted: false,
    });
    expect(Object.keys(store.data)).toEqual([preferencesKey('p1')]);
  });

  it('keeps the viewer choice over the kids default', () => {
    const store = memory();
    savePreferences(store, 'p2', {
      ...loadPreferences(store, 'p2', { kids: true }),
      captionsOn: false,
    });
    expect(loadPreferences(store, 'p2', { kids: true }).captionsOn).toBe(false);
  });

  it('ignores corrupt or out of range stored values', () => {
    const store = memory({
      [preferencesKey('p1')]: '{"volume": 9, "rate": "fast", "muted": "yes"}',
    });
    expect(loadPreferences(store, 'p1', { kids: false })).toMatchObject({
      volume: 1,
      rate: 1,
      muted: false,
    });
    expect(
      loadPreferences(memory({ [preferencesKey('p1')]: '{nope' }), 'p1', { kids: false }).volume,
    ).toBe(1);
  });

  it('survives a store that throws', () => {
    const broken: KeyValueStore = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    expect(loadPreferences(broken, 'p1', { kids: false }).volume).toBe(1);
    expect(() =>
      savePreferences(broken, 'p1', loadPreferences(memory(), 'p1', { kids: false })),
    ).not.toThrow();
  });
});
