import { describe, expect, it } from 'vitest';
import { formatNoticeTime, spokenUnread } from './notice-format';

const NOW = new Date('2026-11-24T14:00:00Z');

describe('formatNoticeTime', () => {
  it('says Today with the Lagos clock time, Yesterday, the weekday, then the date', () => {
    expect(formatNoticeTime('2026-11-24T07:40:00Z', NOW)).toBe('Today, 8:40 am');
    expect(formatNoticeTime('2026-11-23T20:00:00Z', NOW)).toBe('Yesterday');
    expect(formatNoticeTime('2026-11-22T10:00:00Z', NOW)).toBe('Sunday');
    expect(formatNoticeTime('2026-11-02T10:00:00Z', NOW)).toBe('2 Nov');
  });

  it('uses the Lagos day, not UTC, near midnight', () => {
    expect(formatNoticeTime('2026-11-23T23:30:00Z', new Date('2026-11-24T00:10:00Z'))).toBe('Today, 12:30 am');
  });

  it('returns an empty string for a bad date', () => {
    expect(formatNoticeTime('nope', NOW)).toBe('');
  });
});

describe('spokenUnread', () => {
  it('speaks one, many, none and unknown', () => {
    expect(spokenUnread(1)).toBe('1 unread notification');
    expect(spokenUnread(12)).toBe('12 unread notifications');
    expect(spokenUnread(0)).toBe('No unread notifications');
    expect(spokenUnread(null)).toBe('Notifications');
  });
});
