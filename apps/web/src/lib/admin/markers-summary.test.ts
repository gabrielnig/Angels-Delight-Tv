import { describe, expect, it } from 'vitest';
import { markersSummary } from './markers-summary';

describe('markersSummary', () => {
  it('is null when nothing is set', () => {
    expect(markersSummary([], [])).toBeNull();
  });

  it('lists intro, credits and the chapter count on one line', () => {
    expect(
      markersSummary(
        [
          { kind: 'intro', startMs: 12_000, endMs: 48_000 },
          { kind: 'credits', startMs: 310_000, endMs: null },
        ],
        Array.from({ length: 6 }, (_, i) => ({ startMs: i * 10_000, title: `c${i}` })),
      ),
    ).toBe('Intro 0:12 to 0:48, credits from 5:10, 6 chapters');
  });

  it('uses the singular for one chapter and starts with a capital', () => {
    expect(markersSummary([], [{ startMs: 0, title: 'Only' }])).toBe('1 chapter');
    expect(markersSummary([{ kind: 'credits', startMs: 60_000, endMs: null }], [])).toBe('Credits from 1:00');
  });
});
