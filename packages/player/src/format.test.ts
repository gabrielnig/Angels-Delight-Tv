import { describe, expect, it } from 'vitest';
import { formatClock, seekValueText, spokenTime } from './format';

describe('formatClock', () => {
  it('formats minutes and seconds', () => {
    expect(formatClock(134)).toBe('2:14');
    expect(formatClock(5)).toBe('0:05');
  });
  it('adds hours when needed', () => {
    expect(formatClock(3723)).toBe('1:02:03');
  });
  it('is safe for bad input', () => {
    expect(formatClock(Number.NaN)).toBe('0:00');
    expect(formatClock(-4)).toBe('0:00');
    expect(formatClock(Infinity)).toBe('0:00');
  });
});

describe('spokenTime', () => {
  it('speaks minutes and seconds with plurals', () => {
    expect(spokenTime(134)).toBe('2 minutes 14 seconds');
    expect(spokenTime(61)).toBe('1 minute 1 second');
    expect(spokenTime(360)).toBe('6 minutes');
    expect(spokenTime(0)).toBe('0 seconds');
  });
});

describe('seekValueText', () => {
  it('matches the story wording', () => {
    expect(seekValueText(134, 360)).toBe('2 minutes 14 seconds of 6 minutes');
  });
  it('omits the total when duration is unknown', () => {
    expect(seekValueText(10, Number.NaN)).toBe('10 seconds');
  });
});
