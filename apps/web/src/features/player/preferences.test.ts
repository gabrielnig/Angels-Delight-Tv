import { describe, expect, it } from 'vitest';
import {
  THEATRE_KEY,
  readTheatre,
  saveTheatre,
  clearLegacyPreferences,
  captionStyleKey,
  loadPreferences,
  readCaptionStyle,
  saveCaptionStyle,
  captionStylePatch,
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
      autoplayNext: true,
    });
    expect(loadPreferences(memory(), 'p1', { kids: true }).captionsOn).toBe(true);
  });

  it('turns autoplay next on for adults and off for kids profiles unless the profile says otherwise (R15)', () => {
    expect(loadPreferences(memory(), 'p1', { kids: false }).autoplayNext).toBe(true);
    expect(loadPreferences(memory(), 'p1', { kids: true }).autoplayNext).toBe(false);
    expect(
      loadPreferences(memory(), 'p1', { kids: false }, { autoplayNext: false }).autoplayNext,
    ).toBe(false);
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

describe('theatre mode on the device (M43-S08)', () => {
  const memory = (initial: Record<string, string> = {}) => {
    const data = { ...initial };
    return {
      getItem: (k: string) => data[k] ?? null,
      setItem: (k: string, v: string) => void (data[k] = v),
      data,
    };
  };

  it('is off by default and remembers on and off', () => {
    const store = memory();
    expect(readTheatre(store)).toBe(false);
    saveTheatre(store, true);
    expect(readTheatre(store)).toBe(true);
    saveTheatre(store, false);
    expect(readTheatre(store)).toBe(false);
  });

  it('ignores a corrupt stored value and a missing store', () => {
    expect(readTheatre(memory({ [THEATRE_KEY]: '{"x":1}' }))).toBe(false);
    expect(readTheatre(memory({ [THEATRE_KEY]: 'maybe' }))).toBe(false);
    expect(readTheatre(null)).toBe(false);
    expect(() => saveTheatre(null, true)).not.toThrow();
  });
});

describe('caption style on the device (L4-07)', () => {
  const style = {
    size: 'large',
    background: 'none',
    contrast: 'high',
    edge: 'outline',
    color: 'white',
  } as const;

  it('keeps the caption style on the device when there is no profile sync', () => {
    const store = memory();
    saveCaptionStyle(store, 'p1', style);
    expect(store.getItem(captionStyleKey('p1'))).toContain('outline');
    expect(readCaptionStyle(store, 'p1')).toEqual(style);
    expect(readCaptionStyle(store, 'p2')).toBeNull();
  });

  it('ignores corrupt stored style', () => {
    const store = memory();
    store.setItem(captionStyleKey('p1'), '{not json');
    expect(readCaptionStyle(store, 'p1')).toBeNull();
    store.setItem(captionStyleKey('p1'), '"text"');
    expect(readCaptionStyle(store, 'p1')).toBeNull();
    expect(readCaptionStyle(null, 'p1')).toBeNull();
  });

  it('fills unknown fields from the defaults', () => {
    const store = memory();
    store.setItem(captionStyleKey('p1'), JSON.stringify({ size: 'huge', edge: 'outline' }));
    expect(readCaptionStyle(store, 'p1')).toMatchObject({ size: 'medium', edge: 'outline' });
  });

  it('turns a style into the profile service names', () => {
    expect(captionStylePatch(style)).toEqual({
      captionSize: 'large',
      captionBackground: 'none',
      captionContrast: 'high',
      captionEdge: 'outline',
    });
  });
});
