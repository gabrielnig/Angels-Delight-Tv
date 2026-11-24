import type { ProgressSink } from '@ad/player';

/**
 * Where a guest's watched places live: this device only, in one localStorage key (M40-S04, D-G6). One key lets a
 * cap and eviction work in one place and costs one read on a low end phone. The format is versioned. Nothing here
 * ever throws: a blocked, full or corrupt store means the place is simply not saved, and playback goes on.
 */
export const GUEST_PROGRESS_KEY = 'ad:guest:progress:v1';
/** Hard cap on remembered titles. The least recently written is dropped first (R19). */
export const GUEST_PROGRESS_CAP = 100;

export interface GuestStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** p: seconds played, d: duration in seconds, f: finished, t: last write in epoch milliseconds. */
export interface GuestProgressEntry {
  p: number;
  d: number;
  f: boolean;
  t: number;
}

export type GuestProgressItem = GuestProgressEntry & { videoId: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);

function validEntry(value: unknown): value is GuestProgressEntry {
  const e = value as GuestProgressEntry;
  return (
    typeof e === 'object' &&
    e !== null &&
    finite(e.p) &&
    e.p >= 0 &&
    finite(e.d) &&
    e.d >= 0 &&
    typeof e.f === 'boolean' &&
    finite(e.t) &&
    e.t >= 0
  );
}

/** The stored items, or an empty map for anything missing, unreadable or of another version. */
function load(store: GuestStore | null): Record<string, GuestProgressEntry> {
  if (!store) return {};
  let raw: string | null;
  try {
    raw = store.getItem(GUEST_PROGRESS_KEY);
  } catch {
    return {};
  }
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as { v?: unknown; items?: unknown };
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      parsed.v !== 1 ||
      typeof parsed.items !== 'object' ||
      parsed.items === null ||
      Array.isArray(parsed.items)
    )
      return {};
    const items: Record<string, GuestProgressEntry> = {};
    for (const [videoId, entry] of Object.entries(parsed.items)) {
      if (UUID.test(videoId) && validEntry(entry)) items[videoId] = entry;
    }
    return items;
  } catch {
    return {};
  }
}

function save(
  store: GuestStore | null,
  items: Record<string, GuestProgressEntry>,
): { ok: boolean } {
  if (!store) return { ok: false };
  try {
    store.setItem(GUEST_PROGRESS_KEY, JSON.stringify({ v: 1, items }));
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

export function readGuestProgress(
  store: GuestStore | null,
  videoId: string,
): GuestProgressEntry | null {
  return load(store)[videoId] ?? null;
}

/** Newest write first. */
export function listGuestProgress(
  store: GuestStore | null,
  options: { limit?: number } = {},
): GuestProgressItem[] {
  const all = Object.entries(load(store))
    .map(([videoId, entry]) => ({ videoId, ...entry }))
    .sort((a, b) => b.t - a.t);
  return options.limit === undefined ? all : all.slice(0, options.limit);
}

export function writeGuestProgress(
  store: GuestStore | null,
  videoId: string,
  place: { p: number; d: number; f: boolean },
  now: number = Date.now(),
): { ok: boolean } {
  const items = load(store);
  items[videoId] = { p: place.p, d: place.d, f: place.f, t: now };
  const ids = Object.keys(items);
  if (ids.length > GUEST_PROGRESS_CAP) {
    ids
      .sort((a, b) => items[a]!.t - items[b]!.t)
      .slice(0, ids.length - GUEST_PROGRESS_CAP)
      .forEach((id) => delete items[id]);
  }
  return save(store, items);
}

export function removeGuestProgress(store: GuestStore | null, videoId: string): void {
  const items = load(store);
  if (!(videoId in items)) return;
  delete items[videoId];
  save(store, items);
}

export function clearGuestProgress(store: GuestStore | null): void {
  try {
    store?.removeItem(GUEST_PROGRESS_KEY);
  } catch {
    // Nothing to do: a blocked store holds nothing to clear.
  }
}

/** The player's progress sink for a guest. It never throws and reports an unsaved place once through the callback. */
export function createGuestProgressSink(
  store: GuestStore | null,
  options: { now?: () => number; onUnavailable?: () => void } = {},
): ProgressSink {
  let flagged = false;
  return {
    async save(update) {
      const result = writeGuestProgress(
        store,
        update.videoId,
        {
          p: Math.max(0, Math.floor(update.positionSeconds)),
          d: Math.max(0, Math.floor(update.durationSeconds)),
          f: update.ended,
        },
        options.now?.(),
      );
      if (!result.ok && !flagged) {
        flagged = true;
        options.onUnavailable?.();
      }
    },
  };
}
