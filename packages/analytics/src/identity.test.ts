import { describe, expect, it } from 'vitest';
import { classifyDevice, deriveAnalyticsSecret, isBot, viewerHash } from './identity';

const secret = deriveAnalyticsSecret(new Uint8Array(32).fill(7));
const profile = '0b7f6d52-1c3e-4a58-8f19-2a4c6e8d0b31';

describe('viewerHash', () => {
  it('is stable within a day', () => {
    expect(viewerHash(secret, '2026-03-11', profile)).toBe(
      viewerHash(secret, '2026-03-11', profile),
    );
  });
  it('rotates every day so profiles cannot be followed across days', () => {
    expect(viewerHash(secret, '2026-03-11', profile)).not.toBe(
      viewerHash(secret, '2026-03-12', profile),
    );
  });
  it('differs between profiles and does not contain the profile id', () => {
    const other = viewerHash(secret, '2026-03-11', '1b7f6d52-1c3e-4a58-8f19-2a4c6e8d0b31');
    const mine = viewerHash(secret, '2026-03-11', profile);
    expect(other).not.toBe(mine);
    expect(mine).toMatch(/^[0-9a-f]{24}$/);
    expect(mine).not.toContain(profile.slice(0, 8));
  });
  it('depends on the secret', () => {
    const other = deriveAnalyticsSecret(new Uint8Array(32).fill(8));
    expect(viewerHash(other, '2026-03-11', profile)).not.toBe(
      viewerHash(secret, '2026-03-11', profile),
    );
  });
});

describe('isBot', () => {
  it('flags crawlers and empty agents', () => {
    expect(isBot('Mozilla/5.0 (compatible; Googlebot/2.1)')).toBe(true);
    expect(isBot('curl/8.4.0')).toBe(true);
    expect(isBot('HeadlessChrome/120')).toBe(true);
    expect(isBot('')).toBe(true);
    expect(isBot(null)).toBe(true);
  });
  it('lets browsers through', () => {
    expect(
      isBot(
        'Mozilla/5.0 (Linux; Android 13; Tecno) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36',
      ),
    ).toBe(false);
  });
});

describe('classifyDevice', () => {
  it('classifies from the user agent', () => {
    expect(classifyDevice('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)')).toBe('phone');
    expect(
      classifyDevice('Mozilla/5.0 (Linux; Android 13; SM-X700) AppleWebKit Chrome/120 Safari'),
    ).toBe('tablet');
    expect(classifyDevice('Mozilla/5.0 (Linux; Android 13; Tecno) Chrome/120 Mobile Safari')).toBe(
      'phone',
    );
    expect(classifyDevice('Mozilla/5.0 (SMART-TV; Linux; Tizen 6.0)')).toBe('tv');
    expect(classifyDevice('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120')).toBe('desktop');
    expect(classifyDevice(null)).toBe('other');
  });
});
