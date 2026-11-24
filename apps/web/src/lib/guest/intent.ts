import type { GuestStore } from './progress-store';

/** One remembered wish of a visitor, so it can be done after they sign in (M40-S06). */
export const GUEST_INTENT_KEY = 'ad:guest:intent:v1';
export const GUEST_INTENT_MAX_AGE_MS = 30 * 60 * 1000;

export type IntentKind = 'my-list' | 'like';
export type IntentRating = -1 | 1 | 2;
export interface GuestIntent {
  kind: IntentKind;
  itemKey: string;
  /** The rating a visitor picked before signing in. Only a like carries one (M44-S04). */
  value?: IntentRating;
}

const RATINGS: readonly unknown[] = [-1, 1, 2];

const KINDS: readonly string[] = ['my-list', 'like'];
const ITEM_KEY = /^(video|series):[A-Za-z0-9_-]{1,64}$/;

function remove(store: GuestStore | null) {
  try {
    store?.removeItem(GUEST_INTENT_KEY);
  } catch {
    // Storage can be blocked. There is nothing to clean up then.
  }
}

export function clearIntent(store: GuestStore | null): void {
  remove(store);
}

/** Keeps the latest intent only. Storage that is missing or full means the wish is simply forgotten. */
export function saveIntent(
  store: GuestStore | null,
  intent: GuestIntent,
  now: number = Date.now(),
): void {
  if (!store || !ITEM_KEY.test(intent.itemKey)) return;
  try {
    const value = intent.kind === 'like' && RATINGS.includes(intent.value) ? intent.value : undefined;
    store.setItem(
      GUEST_INTENT_KEY,
      JSON.stringify({ v: 1, kind: intent.kind, itemKey: intent.itemKey, value, t: now }),
    );
  } catch {
    // Not remembered. The visitor can save again after signing in.
  }
}

/**
 * Returns the intent once and removes it, when it is one of `kinds` and still fresh. A damaged or old value is
 * removed and ignored. An intent of another kind stays for the code that owns it.
 */
export function takeIntent(
  store: GuestStore | null,
  kinds: readonly IntentKind[],
  now: number = Date.now(),
): GuestIntent | null {
  if (!store) return null;
  let raw: string | null;
  try {
    raw = store.getItem(GUEST_INTENT_KEY);
  } catch {
    return null;
  }
  if (raw === null) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    remove(store);
    return null;
  }
  const value = parsed as {
    v?: unknown;
    kind?: unknown;
    itemKey?: unknown;
    value?: unknown;
    t?: unknown;
  };
  const valid =
    value !== null &&
    typeof value === 'object' &&
    value.v === 1 &&
    typeof value.kind === 'string' &&
    KINDS.includes(value.kind) &&
    typeof value.itemKey === 'string' &&
    ITEM_KEY.test(value.itemKey) &&
    typeof value.t === 'number' &&
    Number.isFinite(value.t);
  if (!valid) {
    remove(store);
    return null;
  }
  const kind = value.kind as IntentKind;
  if (now - (value.t as number) > GUEST_INTENT_MAX_AGE_MS || now < (value.t as number) - 60_000) {
    remove(store);
    return null;
  }
  if (!kinds.includes(kind)) return null;
  remove(store);
  const intent: GuestIntent = { kind, itemKey: value.itemKey as string };
  if (kind === 'like' && RATINGS.includes(value.value)) intent.value = value.value as IntentRating;
  return intent;
}
