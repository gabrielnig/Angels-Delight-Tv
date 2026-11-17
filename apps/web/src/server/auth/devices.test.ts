import { describe, expect, it } from 'vitest';
import { deviceLabel, relativeTime } from './devices';

describe('deviceLabel', () => {
  it('names the browser and system', () => {
    expect(
      deviceLabel(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0 Safari/537.36',
      ),
    ).toBe('Chrome on Windows');
    expect(
      deviceLabel(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit Version/17.5 Mobile Safari/604.1',
      ),
    ).toBe('Safari on iPhone');
    expect(deviceLabel('Mozilla/5.0 (Android 14; Mobile) Gecko/126.0 Firefox/126.0')).toBe(
      'Firefox on Android',
    );
    expect(deviceLabel('Mozilla/5.0 (Windows NT 10.0) Chrome/126 Edg/126')).toBe('Edge on Windows');
  });
  it('falls back for unknown or missing agents', () => {
    expect(deviceLabel(null)).toBe('Unknown device');
    expect(deviceLabel('curl/8')).toBe('Unknown device');
  });
});

describe('relativeTime', () => {
  const now = new Date('2026-03-10T12:00:00Z');
  it('reads naturally', () => {
    expect(relativeTime(new Date('2026-03-10T11:59:40Z'), now)).toBe('Just now');
    expect(relativeTime(new Date('2026-03-10T11:30:00Z'), now)).toBe('30 minutes ago');
    expect(relativeTime(new Date('2026-03-10T09:00:00Z'), now)).toBe('3 hours ago');
    expect(relativeTime(new Date('2026-03-08T12:00:00Z'), now)).toBe('2 days ago');
    expect(relativeTime(new Date('2026-03-09T11:00:00Z'), now)).toBe('1 day ago');
  });
});
