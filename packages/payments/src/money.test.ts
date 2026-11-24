import { describe, expect, it } from 'vitest';
import { checkAmount, formatMoney, isMinorAmount, toMinor } from './money';

describe('toMinor', () => {
  it.each([
    ['1000', 'NGN', 100_000],
    ['1000.5', 'NGN', 100_050],
    ['10.10', 'USD', 1010],
    ['0.01', 'USD', 1],
    ['19.99', 'USD', 1999],
    ['  250 ', 'NGN', 25_000],
  ] as const)('parses %s %s to %d without float error', (major, currency, minor) => {
    expect(toMinor(major, currency)).toBe(minor);
  });
  it('treats a number through its decimal text, so 0.1 + 0.2 style values are refused', () => {
    expect(toMinor(19.99, 'USD')).toBe(1999);
    expect(toMinor(0.1 + 0.2, 'USD')).toBeNull();
  });
  it.each(['', 'abc', '-5', '1e3', '1,000', '10.123', '1.', '.5', '0', '0.00', 'NaN', 'Infinity'])('refuses %j', (bad) => {
    expect(toMinor(bad, 'NGN')).toBeNull();
  });
  it('refuses amounts too large to hold exactly', () => {
    expect(toMinor('99999999999999999', 'NGN')).toBeNull();
  });
});

describe('isMinorAmount', () => {
  it('accepts only positive safe integers', () => {
    expect(isMinorAmount(1)).toBe(true);
    expect(isMinorAmount(100_000)).toBe(true);
    for (const bad of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY, 2 ** 53, '5', null, undefined]) {
      expect(isMinorAmount(bad)).toBe(false);
    }
  });
});

describe('formatMoney', () => {
  it('formats naira and dollars for display', () => {
    expect(formatMoney(100_000, 'NGN')).toBe('₦1,000');
    expect(formatMoney(100_050, 'NGN')).toBe('₦1,000.50');
    expect(formatMoney(1999, 'USD')).toBe('US$19.99');
    expect(formatMoney(500_000, 'USD')).toBe('US$5,000');
  });
});

describe('checkAmount', () => {
  const limits = { min: 20_000, max: 500_000_000 };
  it('accepts an amount inside the limits, edges included', () => {
    expect(checkAmount(20_000, limits)).toEqual({ ok: true });
    expect(checkAmount(500_000_000, limits)).toEqual({ ok: true });
  });
  it('enforces min and max with plain words', () => {
    expect(checkAmount(19_999, limits)).toMatchObject({ ok: false, reason: 'below_min' });
    expect(checkAmount(500_000_001, limits)).toMatchObject({ ok: false, reason: 'above_max' });
  });
  it('refuses a non integer or non positive amount', () => {
    expect(checkAmount(1.5, limits)).toMatchObject({ ok: false, reason: 'invalid' });
    expect(checkAmount(0, limits)).toMatchObject({ ok: false, reason: 'invalid' });
  });
});
