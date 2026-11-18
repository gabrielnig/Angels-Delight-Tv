import { describe, expect, it } from 'vitest';
import { addDays, dayBounds, daysBetween, lagosDay, monthChunks, previousPeriod } from './day';

describe('Lagos day helpers', () => {
  it('maps an instant to the Africa/Lagos calendar day (UTC+1)', () => {
    expect(lagosDay(new Date('2026-03-10T22:59:59Z'))).toBe('2026-03-10');
    expect(lagosDay(new Date('2026-03-10T23:00:00Z'))).toBe('2026-03-11');
  });

  it('returns UTC bounds for a Lagos day', () => {
    const { start, end } = dayBounds('2026-03-11');
    expect(start.toISOString()).toBe('2026-03-10T23:00:00.000Z');
    expect(end.toISOString()).toBe('2026-03-11T23:00:00.000Z');
  });

  it('adds days across month ends', () => {
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('counts days inclusively', () => {
    expect(daysBetween('2026-03-01', '2026-03-07')).toBe(7);
    expect(daysBetween('2026-03-01', '2026-03-01')).toBe(1);
  });

  it('builds the previous period of equal length', () => {
    expect(previousPeriod({ from: '2026-03-08', to: '2026-03-14' })).toEqual({
      from: '2026-03-01',
      to: '2026-03-07',
    });
  });

  it('rejects malformed days', () => {
    expect(() => dayBounds('2026-3-1')).toThrow();
    expect(() => dayBounds('2026-02-30')).toThrow();
  });
});

describe('monthChunks', () => {
  it('cuts a range at month ends, so a big export reads one month at a time', () => {
    expect(monthChunks({ from: '2026-01-15', to: '2026-03-10' })).toEqual([
      { from: '2026-01-15', to: '2026-01-31' },
      { from: '2026-02-01', to: '2026-02-28' },
      { from: '2026-03-01', to: '2026-03-10' },
    ]);
  });

  it('keeps a range inside one month whole, and handles leap February and year ends', () => {
    expect(monthChunks({ from: '2026-05-02', to: '2026-05-02' })).toEqual([
      { from: '2026-05-02', to: '2026-05-02' },
    ]);
    expect(monthChunks({ from: '2028-02-01', to: '2028-02-29' })).toHaveLength(1);
    expect(monthChunks({ from: '2025-12-31', to: '2026-01-01' })).toEqual([
      { from: '2025-12-31', to: '2025-12-31' },
      { from: '2026-01-01', to: '2026-01-01' },
    ]);
  });

  it('gives nothing for a range that ends before it starts', () => {
    expect(monthChunks({ from: '2026-02-02', to: '2026-02-01' })).toEqual([]);
  });
});
