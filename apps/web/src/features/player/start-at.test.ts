import { describe, expect, it } from 'vitest';
import { parseStartAt } from './start-at';

describe('parseStartAt', () => {
  it('reads whole seconds', () => {
    expect(parseStartAt('90')).toBe(90);
    expect(parseStartAt('0')).toBe(0);
  });
  it('takes the first value of a repeated parameter', () => {
    expect(parseStartAt(['45', '90'])).toBe(45);
  });
  it('ignores missing, negative, fractional and non numeric values', () => {
    expect(parseStartAt(undefined)).toBeNull();
    expect(parseStartAt('')).toBeNull();
    expect(parseStartAt('-5')).toBeNull();
    expect(parseStartAt('1.5')).toBeNull();
    expect(parseStartAt('abc')).toBeNull();
    expect(parseStartAt('99999999')).toBeNull();
  });
});
