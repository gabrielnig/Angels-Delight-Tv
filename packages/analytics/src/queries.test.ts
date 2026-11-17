import { describe, expect, it } from 'vitest';
import { buildSplit } from './queries';

describe('buildSplit', () => {
  it('returns percentages and merges groups under the privacy threshold into Other', () => {
    const rows = buildSplit({ phone: 80, desktop: 15, tv: 3, tablet: 2 });
    expect(rows.map((r) => r.label)).toEqual(['phone', 'desktop', 'Other']);
    expect(rows[2]).toMatchObject({ count: 5, percent: 5 });
    expect(rows[0]!.percent).toBe(80);
  });
  it('returns nothing when there is no data', () => {
    expect(buildSplit({})).toEqual([]);
  });
});
