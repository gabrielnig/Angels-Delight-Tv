import { describe, expect, it } from 'vitest';
import type { Profile } from '../data';
import {
  PICKER_CACHE_KEY,
  PICKER_CACHE_MAX_AGE_MS,
  clearPickerCache,
  hintFromCookie,
  readPickerCache,
  savePickerCache,
  type PickerStore,
} from './picker-cache';
import { clearPrivateClientState } from '../pwa/sign-out';

function memory(): PickerStore & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    get length() {
      return data.size;
    },
    key: (i) => Array.from(data.keys())[i] ?? null,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
}

const full: Profile = {
  id: 'p1',
  name: 'Adaeze',
  kids: false,
  owner: true,
  language: 'ig',
  autoplayNext: true,
  lastUsedHere: true,
  hasPin: true,
  dataSaver: true,
  tone: 'mint',
  avatarId: 'owl',
};
const NOW = 1_800_000_000_000;

describe('picker cache (M03-S13)', () => {
  it('round trips only what the picker draws', () => {
    const store = memory();
    savePickerCache(store, 'acct-1', [full], NOW);
    const raw = JSON.parse(store.getItem(PICKER_CACHE_KEY)!);
    expect(raw.profiles[0]).toEqual({
      id: 'p1',
      name: 'Adaeze',
      kids: false,
      tone: 'mint',
      avatarId: 'owl',
      hasPin: true,
    });
    const read = readPickerCache(store, 'acct-1', NOW + 1000);
    expect(read?.profiles).toHaveLength(1);
    expect(read?.profiles[0]).toMatchObject({ id: 'p1', name: 'Adaeze', hasPin: true });
  });

  it('never stores language, data saver, last used or owner details', () => {
    const store = memory();
    savePickerCache(store, 'acct-1', [full], NOW);
    const text = store.getItem(PICKER_CACHE_KEY)!;
    for (const secret of [
      'language',
      'dataSaver',
      'lastUsedHere',
      'autoplayNext',
      'owner',
      'email',
    ]) {
      expect(text).not.toContain(secret);
    }
  });

  it('ignores a list older than 7 days and a list for another account', () => {
    const store = memory();
    savePickerCache(store, 'acct-1', [full], NOW);
    expect(readPickerCache(store, 'acct-1', NOW + PICKER_CACHE_MAX_AGE_MS)).not.toBeNull();
    expect(readPickerCache(store, 'acct-1', NOW + PICKER_CACHE_MAX_AGE_MS + 1)).toBeNull();
    expect(readPickerCache(store, 'acct-2', NOW + 1)).toBeNull();
  });

  it('treats damaged or blocked storage as no cache', () => {
    const store = memory();
    store.setItem(PICKER_CACHE_KEY, '{not json');
    expect(readPickerCache(store, 'acct-1', NOW)).toBeNull();
    store.setItem(
      PICKER_CACHE_KEY,
      JSON.stringify({ v: 1, accountId: 'acct-1', savedAt: NOW, profiles: [{ id: 3 }] }),
    );
    expect(readPickerCache(store, 'acct-1', NOW)).toBeNull();
    const blocked: PickerStore = {
      ...memory(),
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    expect(readPickerCache(blocked, 'acct-1', NOW)).toBeNull();
    expect(() => savePickerCache(blocked, 'acct-1', [full], NOW)).not.toThrow();
  });

  it('is cleared by clearPickerCache and by the private state wipe at sign out', () => {
    const store = memory();
    savePickerCache(store, 'acct-1', [full], NOW);
    clearPickerCache(store);
    expect(store.getItem(PICKER_CACHE_KEY)).toBeNull();
    savePickerCache(store, 'acct-1', [full], NOW);
    store.setItem('ad.install.v1', '{}');
    clearPrivateClientState(store);
    expect(Array.from(store.data.keys())).toEqual(['ad.install.v1']);
  });

  it('reads the account hint cookie', () => {
    expect(hintFromCookie('a=1; ad_acct=acct-1; b=2')).toBe('acct-1');
    expect(hintFromCookie('a=1')).toBeNull();
  });
});
