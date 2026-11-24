import { describe, expect, it } from 'vitest';
import { groupActivity } from './activity-groups';

const NOW = new Date('2026-11-25T15:00:00Z');
const item = (id: string, iso: string) => ({ videoId: id, watchedAt: iso });

describe('groupActivity', () => {
  it('names Today, Yesterday, Earlier this week, then months', () => {
    const groups = groupActivity(
      [
        item('a', '2026-11-25T09:00:00Z'),
        item('b', '2026-11-24T22:00:00Z'),
        item('c', '2026-11-22T12:00:00Z'),
        item('d', '2026-11-10T12:00:00Z'),
        item('e', '2026-10-30T12:00:00Z'),
        item('f', '2025-12-01T12:00:00Z'),
      ],
      NOW,
    );
    expect(groups.map((g) => g.label)).toEqual([
      'Today',
      'Yesterday',
      'Earlier this week',
      'November 2026',
      'October 2026',
      'December 2025',
    ]);
    expect(groups.map((g) => g.items.length)).toEqual([1, 1, 1, 1, 1, 1]);
  });

  it('keeps order and merges neighbours that share a label', () => {
    const groups = groupActivity(
      [item('a', '2026-11-25T09:00:00Z'), item('b', '2026-11-25T08:00:00Z')],
      NOW,
    );
    expect(groups).toHaveLength(1);
    expect(groups[0]?.items.map((i) => i.videoId)).toEqual(['a', 'b']);
  });

  it('returns nothing for an empty list', () => {
    expect(groupActivity([], NOW)).toEqual([]);
  });
});
