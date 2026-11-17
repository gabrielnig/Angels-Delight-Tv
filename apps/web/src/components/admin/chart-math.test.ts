import { describe, expect, it } from 'vitest';
import { describeSeries, formatCompact, layoutSeries, niceMax } from './chart-math';

describe('chart math', () => {
  it('rounds the axis maximum up to a tidy number', () => {
    expect(niceMax(0)).toBe(1);
    expect(niceMax(2400)).toBe(2500);
    expect(niceMax(9)).toBe(10);
    expect(niceMax(14900)).toBe(20000);
    expect(niceMax(100)).toBe(100);
  });
  it('formats compact numbers', () => {
    expect(formatCompact(950)).toBe('950');
    expect(formatCompact(12400)).toBe('12.4k');
    expect(formatCompact(2_500_000)).toBe('2.5m');
  });
  it('describes a series in words', () => {
    expect(describeSeries([{ label: 'Mon', value: 10 }, { label: 'Tue', value: 30 }, { label: 'Wed', value: 5 }], 'views')).toBe(
      '3 points, 45 views in total. Highest: Tue with 30. Lowest: Wed with 5.',
    );
    expect(describeSeries([], 'views')).toBe('No views to show.');
  });
  it('lays out points with the highest at the top', () => {
    const out = layoutSeries([{ label: 'a', value: 0 }, { label: 'b', value: 50 }, { label: 'c', value: 100 }], 200, 100, 100);
    expect(out.map((p) => [p.x, p.y])).toEqual([[0, 100], [100, 50], [200, 0]]);
  });
});
