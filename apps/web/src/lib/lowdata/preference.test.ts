import { describe, expect, it } from 'vitest';
import {
  dataSaverKey,
  readStoredPreference,
  resolveDataSaver,
  writePreference,
  type KeyValueStore,
} from './preference';

const memory = (): KeyValueStore & { map: Map<string, string> } => {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => void map.set(key, value),
  };
};

describe('data saver preference', () => {
  it('keys the preference by profile so each profile keeps its own choice', () => {
    expect(dataSaverKey('p1')).not.toBe(dataSaverKey('p2'));
    expect(dataSaverKey(null)).toBe('ad.datasaver.guest');
  });

  it('stores and reads on and off, and ignores junk', () => {
    const store = memory();
    expect(readStoredPreference(store, 'p1')).toBeNull();
    writePreference(store, 'p1', true);
    expect(readStoredPreference(store, 'p1')).toBe(true);
    writePreference(store, 'p1', false);
    expect(readStoredPreference(store, 'p1')).toBe(false);
    store.map.set(dataSaverKey('p1'), 'banana');
    expect(readStoredPreference(store, 'p1')).toBeNull();
  });

  it('survives a storage that throws', () => {
    const broken: KeyValueStore = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    expect(readStoredPreference(broken, 'p1')).toBeNull();
    expect(() => writePreference(broken, 'p1', true)).not.toThrow();
  });
});

describe('resolveDataSaver', () => {
  it('lets the viewer choice win over the browser signal', () => {
    expect(resolveDataSaver({ stored: false, browserWantsSaving: true })).toEqual({
      on: false,
      source: 'user',
      announce: false,
    });
    expect(resolveDataSaver({ stored: true, browserWantsSaving: false })).toEqual({
      on: true,
      source: 'user',
      announce: false,
    });
  });
  it('defaults on and announces once when the browser asks for Save-Data (M25-S03 AC2)', () => {
    expect(resolveDataSaver({ stored: null, browserWantsSaving: true })).toEqual({
      on: true,
      source: 'browser',
      announce: true,
    });
  });
  it('stays off by default on a normal connection', () => {
    expect(resolveDataSaver({ stored: null, browserWantsSaving: false })).toEqual({
      on: false,
      source: 'default',
      announce: false,
    });
  });
});
