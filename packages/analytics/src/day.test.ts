import { describe, expect, it } from 'vitest';
import { addDays, dayBounds, daysBetween, lagosDay, previousPeriod } from './day';

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
