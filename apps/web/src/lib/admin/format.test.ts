import { describe, expect, it } from 'vitest';
import { formatCount, formatDuration, formatRelative, fromLagosInput, spokenDuration, toLagosInput } from './format';

describe('format', () => {
  it('formats durations', () => {
    expect(formatDuration(252)).toBe('4:12');
    expect(formatDuration(3725)).toBe('1:02:05');
    expect(formatDuration(5)).toBe('0:05');
  });
  it('speaks durations', () => {
    expect(spokenDuration(252)).toBe('4 minutes 12 seconds');
    expect(spokenDuration(60)).toBe('1 minute');
    expect(spokenDuration(1)).toBe('1 second');
  });
  it('formats counts', () => {
    expect(formatCount(12400)).toBe('12.4k');
    expect(formatCount(87)).toBe('87');
  });
  it('round trips Lagos local time', () => {
    const iso = '2026-11-17T15:00:00.000Z';
    expect(toLagosInput(iso)).toBe('2026-11-17T16:00');
    expect(fromLagosInput('2026-11-17T16:00')).toBe(iso);
    expect(fromLagosInput('nope')).toBeNull();
  });
  it('formats relative time', () => {
    const now = Date.parse('2026-11-17T12:00:00Z');
    expect(formatRelative('2026-11-17T11:50:00Z', now)).toBe('10 min ago');
    expect(formatRelative('2026-11-16T12:00:00Z', now)).toBe('Yesterday');
  });
});
