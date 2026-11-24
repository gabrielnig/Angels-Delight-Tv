import { describe, expect, it } from 'vitest';
import {
  NOTICE_KEY,
  NOTICE_MAX_AGE_MS,
  dismissNotice,
  noticeVisible,
  readNotice,
  type NoticeStore,
} from './notice';

const NOW = Date.UTC(2026, 10, 24);

function memory(initial: Record<string, string> = {}): NoticeStore & { data: Record<string, string> } {
  const data = { ...initial };
  return {
    data,
    getItem: (key) => data[key] ?? null,
    setItem: (key, value) => {
      data[key] = value;
    },
  };
}

const blocked: NoticeStore = {
  getItem() {
    throw new Error('blocked');
  },
  setItem() {
    throw new Error('blocked');
  },
};

describe('storage notice state (M45-S11)', () => {
  it('uses the key ad:notice:v1', () => {
    expect(NOTICE_KEY).toBe('ad:notice:v1');
  });

  it('shows when it was never dismissed', () => {
    expect(noticeVisible(readNotice(memory()), 1, NOW)).toBe(true);
  });

  it('hides after dismissal', () => {
    const store = memory();
    dismissNotice(store, 1, NOW);
    expect(noticeVisible(readNotice(store), 1, NOW + 1000)).toBe(false);
  });

  it('returns when the admin raises the version', () => {
    const store = memory();
    dismissNotice(store, 1, NOW);
    expect(noticeVisible(readNotice(store), 2, NOW + 1000)).toBe(true);
  });

  it('returns after 12 months and not a day before', () => {
    const store = memory();
    dismissNotice(store, 1, NOW);
    expect(NOTICE_MAX_AGE_MS).toBe(365 * 24 * 60 * 60 * 1000);
    expect(noticeVisible(readNotice(store), 1, NOW + NOTICE_MAX_AGE_MS - 1)).toBe(false);
    expect(noticeVisible(readNotice(store), 1, NOW + NOTICE_MAX_AGE_MS)).toBe(true);
  });

  it('survives blocked storage: always shown, nothing throws', () => {
    expect(readNotice(blocked)).toBeNull();
    expect(() => dismissNotice(blocked, 1, NOW)).not.toThrow();
    expect(noticeVisible(readNotice(blocked), 1, NOW)).toBe(true);
    expect(readNotice(null)).toBeNull();
  });

  it('treats junk in storage as never dismissed', () => {
    for (const raw of ['not json', '{}', '{"version":"x","at":1}', 'null', '[]']) {
      expect(noticeVisible(readNotice(memory({ [NOTICE_KEY]: raw })), 1, NOW)).toBe(true);
    }
  });

  it('treats a dismissal dated in the future as never dismissed', () => {
    const store = memory({ [NOTICE_KEY]: JSON.stringify({ version: 1, at: NOW + 10_000 }) });
    expect(noticeVisible(readNotice(store), 1, NOW)).toBe(true);
  });
});
