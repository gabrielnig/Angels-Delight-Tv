import { describe, expect, it } from 'vitest';
import {
  detectPlatform,
  recordVisit,
  shouldShowInstall,
  dismissInstall,
  type InstallState,
} from './install';

const DAY = 86_400_000;
const empty: InstallState = { visits: [], dismissedUntil: null, dismissCount: 0, installed: false };
const t0 = Date.UTC(2026, 2, 1, 10);

describe('recordVisit', () => {
  it('adds a visit at most once per hour and keeps the last 10', () => {
    let s = recordVisit(empty, t0);
    s = recordVisit(s, t0 + 1000);
    expect(s.visits).toHaveLength(1);
    for (let i = 1; i <= 12; i += 1) s = recordVisit(s, t0 + i * DAY);
    expect(s.visits).toHaveLength(10);
  });
});

describe('shouldShowInstall (M25-S01 AC1)', () => {
  const visited = { ...empty, visits: [t0, t0 + 3 * DAY] };
  it('needs two visits at least 3 days apart', () => {
    expect(shouldShowInstall({ ...empty, visits: [t0] }, t0 + DAY, 'chromium')).toBe(false);
    expect(shouldShowInstall({ ...empty, visits: [t0, t0 + DAY] }, t0 + DAY, 'chromium')).toBe(
      false,
    );
    expect(shouldShowInstall(visited, t0 + 3 * DAY, 'chromium')).toBe(true);
  });
  it('stays hidden for 30 days after Not now', () => {
    const s = dismissInstall(visited, t0 + 3 * DAY);
    expect(shouldShowInstall(s, t0 + 10 * DAY, 'chromium')).toBe(false);
    expect(shouldShowInstall(s, t0 + 34 * DAY, 'chromium')).toBe(true);
  });
  it('never returns after two dismissals or an install', () => {
    const twice = dismissInstall(dismissInstall(visited, t0), t0 + 40 * DAY);
    expect(shouldShowInstall(twice, t0 + 200 * DAY, 'chromium')).toBe(false);
    expect(shouldShowInstall({ ...visited, installed: true }, t0 + 9 * DAY, 'chromium')).toBe(
      false,
    );
  });
  it('shows nothing when already running installed or unsupported', () => {
    expect(shouldShowInstall(visited, t0 + 9 * DAY, 'standalone')).toBe(false);
    expect(shouldShowInstall(visited, t0 + 9 * DAY, 'none')).toBe(false);
  });
  it('shows iOS instructions on Safari and the open in Safari notice elsewhere', () => {
    expect(shouldShowInstall(visited, t0 + 9 * DAY, 'ios-safari')).toBe(true);
    expect(shouldShowInstall(visited, t0 + 9 * DAY, 'ios-other')).toBe(true);
  });
});

describe('detectPlatform', () => {
  const iphoneSafari =
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
  const iphoneChrome =
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 CriOS/120.0 Mobile/15E148 Safari/604.1';
  const iphoneFacebook =
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 [FBAN/FBIOS;FBAV/430]';
  const android =
    'Mozilla/5.0 (Linux; Android 13; Tecno) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36';
  it('recognises each case', () => {
    expect(detectPlatform({ userAgent: iphoneSafari, standalone: false, canPrompt: false })).toBe(
      'ios-safari',
    );
    expect(detectPlatform({ userAgent: iphoneChrome, standalone: false, canPrompt: false })).toBe(
      'ios-other',
    );
    expect(detectPlatform({ userAgent: iphoneFacebook, standalone: false, canPrompt: false })).toBe(
      'ios-other',
    );
    expect(detectPlatform({ userAgent: android, standalone: false, canPrompt: true })).toBe(
      'chromium',
    );
    expect(detectPlatform({ userAgent: android, standalone: false, canPrompt: false })).toBe(
      'none',
    );
    expect(detectPlatform({ userAgent: android, standalone: true, canPrompt: false })).toBe(
      'standalone',
    );
  });
});
