import { describe, expect, it } from 'vitest';
import { buildSplit, shareRows } from './queries';

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

describe('shareRows', () => {
  it('orders channels by count and drops zero and unknown keys', () => {
    expect(
      shareRows([
        { key: 'copy', total: '4' },
        { key: 'whatsapp', total: '9' },
        { key: 'myspace', total: '3' },
        { key: 'x', total: '0' },
      ]),
    ).toEqual([
      { channel: 'whatsapp', count: 9 },
      { channel: 'copy', count: 4 },
    ]);
  });
});
