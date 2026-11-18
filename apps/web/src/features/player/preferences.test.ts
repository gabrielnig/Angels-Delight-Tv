import { describe, expect, it } from 'vitest';
import {
  clearLegacyPreferences,
  loadPreferences,
  preferencesKey,
  readLegacyPreferences,
  serverChanges,
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
    });
    expect(loadPreferences(store, 'p1', { kids: false })).toMatchObject({
      volume: 0.4,
      muted: true,
    });
    expect(loadPreferences(store, 'p2', { kids: false })).toMatchObject({
      volume: 1,
      muted: false,
    });
    expect(Object.keys(store.data)).toEqual([preferencesKey('p1')]);
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

describe('loadPreferences with profile defaults', () => {
  const none = null;
  it('uses the profile settings from the server when the device has none', () => {
    const prefs = loadPreferences(
      none,
      'p1',
      { kids: false },
      { autoplayNext: true, dataSaver: true, rate: 1.5 },
    );
    expect(prefs).toMatchObject({
      autoplayNext: true,
      dataSaver: true,
      rate: 1.5,
      captionsOn: false,
    });
  });

  it('still defaults captions on for kids', () => {
    expect(loadPreferences(none, 'p1', { kids: true }, {}).captionsOn).toBe(true);
  });
});

describe('server owned preferences (M03-S09)', () => {
  const server = {
    rate: 1.5,
    captionsOn: true,
    captionLanguage: 'yo',
    dataSaver: true,
    autoplayNext: true,
  };

  it('takes speed, captions, data saver and autoplay from the server, not from this device', () => {
    const store = memory({
      [preferencesKey('p1')]: JSON.stringify({
        rate: 2,
        captionsOn: false,
        volume: 0.3,
        muted: true,
      }),
    });
    const prefs = loadPreferences(store, 'p1', { kids: false }, server);
    expect(prefs).toMatchObject({ ...server, volume: 0.3, muted: true });
  });

  it('saves only volume and mute on the device', () => {
    const store = memory();
    savePreferences(store, 'p1', {
      ...loadPreferences(store, 'p1', { kids: false }, server),
      volume: 0.5,
      rate: 0.75,
    });
    expect(JSON.parse(store.data[preferencesKey('p1')]!)).toEqual({ volume: 0.5, muted: false });
  });

  it('reads what an older version kept on the device so it can move to the server', () => {
    const store = memory({
      [preferencesKey('p1')]: JSON.stringify({
        rate: 1.25,
        captionsOn: true,
        captionLanguage: 'ig',
        dataSaver: true,
        autoplayNext: false,
        volume: 0.4,
        muted: false,
      }),
    });
    expect(readLegacyPreferences(store, 'p1')).toEqual({
      speed: 1.25,
      captionsDefault: true,
      captionLanguage: 'ig',
      dataSaver: true,
      autoplayNext: false,
    });
    expect(readLegacyPreferences(memory(), 'p1')).toBeNull();
    expect(
      readLegacyPreferences(memory({ [preferencesKey('p1')]: '{"volume":0.4}' }), 'p1'),
    ).toBeNull();
  });

  it('strips the moved fields and keeps volume and mute', () => {
    const store = memory({
      [preferencesKey('p1')]: JSON.stringify({ rate: 1.25, volume: 0.4, muted: true }),
    });
    clearLegacyPreferences(store, 'p1');
    expect(JSON.parse(store.data[preferencesKey('p1')]!)).toEqual({ volume: 0.4, muted: true });
    expect(readLegacyPreferences(store, 'p1')).toBeNull();
  });

  it('works out which server fields changed, using the server names', () => {
    const before = { ...server, volume: 1, muted: false };
    expect(serverChanges(before, { ...before, rate: 2, volume: 0.2 })).toEqual({ speed: 2 });
    expect(serverChanges(before, { ...before, captionsOn: false, captionLanguage: 'en' })).toEqual({
      captionsDefault: false,
      captionLanguage: 'en',
    });
    expect(serverChanges(before, before)).toEqual({});
  });
});
