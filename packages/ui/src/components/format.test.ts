import { describe, expect, it } from 'vitest';
import {
  formatClock,
  formatDuration,
  formatTimeLeft,
  spokenDuration,
  spokenLength,
} from './format';

describe('formatDuration', () => {
  it.each([
    [0, '1 min'],
    [20, '1 min'],
    [60, '1 min'],
    [250, '4 min'],
    [3600, '1 hr'],
    [4800, '1 hr 20 min'],
  ])('%i seconds is %s', (seconds, text) => {
    expect(formatDuration(seconds)).toBe(text);
  });
});

describe('formatClock', () => {
  it('uses m:ss and h:mm:ss', () => {
    expect(formatClock(252)).toBe('4:12');
    expect(formatClock(5)).toBe('0:05');
    expect(formatClock(3725)).toBe('1:02:05');
  });
});

describe('spoken forms', () => {
  it('spells out exact duration', () => {
    expect(spokenDuration(252)).toBe('4 minutes 12 seconds');
    expect(spokenDuration(61)).toBe('1 minute 1 second');
    expect(spokenDuration(45)).toBe('45 seconds');
  });

  it('spells out approximate length for card names', () => {
    expect(spokenLength(252)).toBe('4 minutes');
    expect(spokenLength(60)).toBe('1 minute');
    expect(spokenLength(30)).toBe('1 minute');
    expect(spokenLength(4800)).toBe('1 hour 20 minutes');
  });
});

describe('formatTimeLeft', () => {
  it('reads like 12 min left', () => {
    expect(formatTimeLeft(720)).toBe('12 min left');
    expect(formatTimeLeft(20)).toBe('1 min left');
  });
});
