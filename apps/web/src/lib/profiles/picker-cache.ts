import type { Profile } from '../data';

/**
 * The cached profile list for the picker (M03-S13). It holds only what a tile needs: id, name, kids flag, tone,
 * avatar and whether a PIN is set. No language, settings, history or email. It lives under a private prefix, so
 * sign out wipes it (lib/pwa/sign-out.ts), and a list older than 7 days or from another account is ignored.
 */
export const PICKER_CACHE_KEY = 'ad.pickercache.v1';
export const PICKER_CACHE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
/** A cookie that holds the signed in account id (not secret), so the loading screen can tell whose cache it is. */
export const ACCOUNT_HINT_COOKIE = 'ad_acct';

export type PickerProfile = Pick<Profile, 'id' | 'name' | 'kids' | 'tone' | 'avatarId' | 'hasPin'>;

export interface PickerStore {
  readonly length: number;
  key(index: number): string | null;
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

interface Stored {
  v: 1;
  accountId: string;
  savedAt: number;
  profiles: PickerProfile[];
}

export function savePickerCache(
  store: Pick<PickerStore, 'setItem'>,
  accountId: string,
  profiles: Profile[],
  now: number,
): void {
  const slim = profiles.map((p) => {
    const out: PickerProfile = { id: p.id, name: p.name, kids: p.kids };
    if (p.tone) out.tone = p.tone;
    if (p.avatarId) out.avatarId = p.avatarId;
    if (p.hasPin) out.hasPin = true;
    return out;
  });
  const value: Stored = { v: 1, accountId, savedAt: now, profiles: slim };
  try {
    store.setItem(PICKER_CACHE_KEY, JSON.stringify(value));
  } catch {
    // Storage blocked or full: the picker simply has no cache next time.
  }
}

const isProfile = (p: unknown): p is PickerProfile => {
  if (typeof p !== 'object' || p === null) return false;
  const o = p as Record<string, unknown>;
  return (
    typeof o['id'] === 'string' && typeof o['name'] === 'string' && typeof o['kids'] === 'boolean'
  );
};

export function readPickerCache(
  store: Pick<PickerStore, 'getItem'>,
  accountId: string,
  now: number,
): { profiles: PickerProfile[]; savedAt: number } | null {
  try {
    const raw = store.getItem(PICKER_CACHE_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<Stored>;
    if (value.v !== 1 || value.accountId !== accountId) return null;
    if (typeof value.savedAt !== 'number' || now - value.savedAt > PICKER_CACHE_MAX_AGE_MS)
      return null;
    if (!Array.isArray(value.profiles) || !value.profiles.every(isProfile)) return null;
    return { profiles: value.profiles, savedAt: value.savedAt };
  } catch {
    return null;
  }
}

export function clearPickerCache(store: Pick<PickerStore, 'removeItem'>): void {
  try {
    store.removeItem(PICKER_CACHE_KEY);
  } catch {
    // Nothing to clear when storage is blocked.
  }
}

export function hintFromCookie(cookie: string): string | null {
  const match = cookie
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${ACCOUNT_HINT_COOKIE}=`));
  return match ? decodeURIComponent(match.slice(ACCOUNT_HINT_COOKIE.length + 1)) : null;
}
