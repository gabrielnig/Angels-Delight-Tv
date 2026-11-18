import { describe, expect, it } from 'vitest';
import { MAX_EVENTS_PER_BATCH, normalizeSearchQuery, parseBatch } from './events';

const playId = '3f2b8c1e-5d4a-4e7b-9a1c-0d2e4f6a8b10';
const videoId = '0b7f6d52-1c3e-4a58-8f19-2a4c6e8d0b31';

describe('parseBatch', () => {
  it('accepts every event kind', () => {
    const result = parseBatch({
      v: 1,
      deviceClass: 'phone',
      saveData: true,
      events: [
        { kind: 'view_start', playId, videoId, maxHeight: 360 },
        { kind: 'progress', playId, videoId, watchedMs: 12000, positionMs: 15000 },
        { kind: 'complete', playId, videoId, watchedMs: 590000 },
        { kind: 'search', resultCount: 0, query: 'Plants' },
        { kind: 'error', code: 'player.network', videoId },
        { kind: 'vitals', name: 'LCP', value: 2100.5, route: '/watch/[slug]' },
        { kind: 'startup', videoId, startupMs: 1800 },
        { kind: 'rebuffer', videoId, rebufferMs: 900 },
      ],
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.events).toHaveLength(8);
      expect(result.rejected).toBe(0);
      expect(result.deviceClass).toBe('phone');
      expect(result.saveData).toBe(true);
    }
  });

  it('drops invalid events but keeps the valid ones', () => {
    const result = parseBatch({
      v: 1,
      events: [
        { kind: 'progress', playId, videoId, watchedMs: -5, positionMs: 0 },
        { kind: 'progress', playId, videoId, watchedMs: 5000, positionMs: 5000 },
        { kind: 'nope' },
      ],
    });
    expect(result.ok && result.events).toHaveLength(1);
    expect(result.ok && result.rejected).toBe(2);
  });

  it('rejects unknown keys so no stray personal data is stored', () => {
    const result = parseBatch({
      v: 1,
      events: [{ kind: 'view_start', playId, videoId, email: 'a@b.co' }],
    });
    expect(result.ok && result.events).toHaveLength(0);
    expect(result.ok && result.rejected).toBe(1);
  });

  it('rejects a bad envelope', () => {
    expect(parseBatch(null).ok).toBe(false);
    expect(parseBatch({ v: 2, events: [] }).ok).toBe(false);
    expect(parseBatch({ v: 1, events: 'x' }).ok).toBe(false);
  });

  it('rejects oversized batches', () => {
    const events = Array.from({ length: MAX_EVENTS_PER_BATCH + 1 }, () => ({
      kind: 'error',
      code: 'x',
    }));
    expect(parseBatch({ v: 1, events }).ok).toBe(false);
  });

  it('bounds watch time to something a person could watch', () => {
    const result = parseBatch({
      v: 1,
      events: [{ kind: 'progress', playId, videoId, watchedMs: 99_999_999_999, positionMs: 0 }],
    });
    expect(result.ok && result.events).toHaveLength(0);
  });

  it('only accepts error codes in a safe shape', () => {
    const bad = parseBatch({ v: 1, events: [{ kind: 'error', code: 'Has Spaces And @' }] });
    expect(bad.ok && bad.events).toHaveLength(0);
  });
});

describe('normalizeSearchQuery', () => {
  it('lowercases, trims and collapses spaces', () => {
    expect(normalizeSearchQuery('  Money   Basics ')).toBe('money basics');
  });
  it('drops queries that look like personal data', () => {
    expect(normalizeSearchQuery('me@example.com')).toBeNull();
    expect(normalizeSearchQuery('call 08031234567')).toBeNull();
  });
  it('truncates long queries and returns null for empty ones', () => {
    expect(normalizeSearchQuery('a'.repeat(200))).toHaveLength(60);
    expect(normalizeSearchQuery('   ')).toBeNull();
  });
});
