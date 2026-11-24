import type { SponsorSlot } from '@ad/shared';

/**
 * Frequency caps live in a first party cookie that holds only creative ids and counts, never an identifier for
 * the person (D-252). Day caps (Home, Title) use `ad_spc`, which lives one day. Player caps count per visit and use
 * `ad_sps`, a session cookie. Both are written by the impression endpoint and never read or set for kids.
 */
export const CAP_COOKIE_MAX_ENTRIES = 20;
const MAX_RAW_LENGTH = 2400;
const MAX_COUNT = 1000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const SLOT_CODE: Record<SponsorSlot, string> = {
  home_banner: 'h',
  title_card: 't',
  player_after: 'a',
  player_before: 'b',
};
const CODES = new Set(Object.values(SLOT_CODE));

/** Key is `<creative id>.<slot code>`, value is `[Lagos day number, count]`. */
export type CapMap = Record<string, [number, number]>;

const keyOf = (creativeId: string, slot: SponsorSlot) => `${creativeId}.${SLOT_CODE[slot]}`;

export const isSessionSlot = (slot: SponsorSlot): boolean =>
  slot === 'player_after' || slot === 'player_before';

export const capCookieName = (slot: SponsorSlot): 'ad_spc' | 'ad_sps' =>
  isSessionSlot(slot) ? 'ad_sps' : 'ad_spc';

export interface CapCookieOptions {
  httpOnly: true;
  secure: boolean;
  sameSite: 'lax';
  path: '/';
  maxAge?: number;
}

export function capCookieOptions(slot: SponsorSlot, secure: boolean): CapCookieOptions {
  const base: CapCookieOptions = { httpOnly: true, secure, sameSite: 'lax', path: '/' };
  return isSessionSlot(slot) ? base : { ...base, maxAge: 86_400 };
}

/** Anything unexpected gives an empty map. Entries from other days are dropped. */
export function parseCapCookie(raw: string | undefined | null, today: number): CapMap {
  if (!raw || raw.length > MAX_RAW_LENGTH) return {};
  let data: unknown;
  try {
    data = JSON.parse(decodeURIComponent(raw));
  } catch {
    return {};
  }
  if (data === null || typeof data !== 'object' || Array.isArray(data)) return {};
  const entries = Object.entries(data as Record<string, unknown>);
  if (entries.length > CAP_COOKIE_MAX_ENTRIES * 2) return {};
  const map: CapMap = {};
  for (const [key, value] of entries) {
    const [id, code] = key.split('.');
    if (!id || !code || !UUID.test(id) || !CODES.has(code)) continue;
    if (!Array.isArray(value) || value.length !== 2) continue;
    const [day, count] = value as [unknown, unknown];
    if (!Number.isInteger(day) || !Number.isInteger(count)) continue;
    if (day !== today || (count as number) < 1 || (count as number) > MAX_COUNT) continue;
    map[key] = [day as number, count as number];
    if (Object.keys(map).length >= CAP_COOKIE_MAX_ENTRIES) break;
  }
  return map;
}

export function serializeCapCookie(map: CapMap): string {
  return encodeURIComponent(JSON.stringify(map));
}

export function capCount(map: CapMap, creativeId: string, slot: SponsorSlot, today: number): number {
  const entry = map[keyOf(creativeId, slot)];
  return entry && entry[0] === today ? entry[1] : 0;
}

/** Returns a new map with one more impression. Other days are dropped, the oldest entries go past 20. */
export function recordImpression(
  map: CapMap,
  creativeId: string,
  slot: SponsorSlot,
  today: number,
): CapMap {
  const key = keyOf(creativeId, slot);
  const next: CapMap = {};
  for (const [k, v] of Object.entries(map)) {
    if (v[0] === today && k !== key) next[k] = v;
  }
  next[key] = [today, Math.min(capCount(map, creativeId, slot, today) + 1, MAX_COUNT)];
  const keys = Object.keys(next);
  for (const k of keys.slice(0, Math.max(0, keys.length - CAP_COOKIE_MAX_ENTRIES))) delete next[k];
  return next;
}
