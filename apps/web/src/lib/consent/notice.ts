/**
 * Storage notice memory (M45-S11). One localStorage key holds the notice version the visitor dismissed and when.
 * The notice returns when the admin raises the version or 12 months pass. Blocked storage means "never dismissed",
 * so the notice shows each visit and nothing throws.
 */
export const NOTICE_KEY = 'ad:notice:v1';
export const NOTICE_MAX_AGE_MS = 365 * 24 * 60 * 60 * 1000;

export interface NoticeStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface NoticeRecord {
  version: number;
  at: number;
}

export function readNotice(store: NoticeStore | null): NoticeRecord | null {
  if (!store) return null;
  try {
    const parsed: unknown = JSON.parse(store.getItem(NOTICE_KEY) ?? 'null');
    if (typeof parsed !== 'object' || parsed === null) return null;
    const { version, at } = parsed as Record<string, unknown>;
    if (typeof version !== 'number' || typeof at !== 'number') return null;
    if (!Number.isFinite(version) || !Number.isFinite(at)) return null;
    return { version, at };
  } catch {
    return null;
  }
}

export function noticeVisible(record: NoticeRecord | null, version: number, now: number): boolean {
  if (!record) return true;
  if (record.version !== version) return true;
  if (record.at > now) return true;
  return now - record.at >= NOTICE_MAX_AGE_MS;
}

export function dismissNotice(store: NoticeStore | null, version: number, now: number): void {
  try {
    store?.setItem(NOTICE_KEY, JSON.stringify({ version, at: now }));
  } catch {
    // Storage is blocked or full. The notice shows again next visit, which is the documented behaviour.
  }
}
