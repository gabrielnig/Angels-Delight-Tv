import { describe, expect, it } from 'vitest';
import { OPTIONAL_EVENT_KINDS, allowEvent, canUse, privacySignalOn } from './guard';

describe('consent guard (M45-S12)', () => {
  it('allows necessary and functional storage only', () => {
    expect(canUse('necessary')).toBe(true);
    expect(canUse('functional')).toBe(true);
    expect(canUse('analytics-identified')).toBe(false);
    expect(canUse('marketing')).toBe(false);
  });

  it('treats an unknown category as not allowed', () => {
    expect(canUse('something-new' as never)).toBe(false);
  });

  it('reads Global Privacy Control and Do Not Track', () => {
    expect(privacySignalOn({ globalPrivacyControl: true })).toBe(true);
    expect(privacySignalOn({ doNotTrack: '1' })).toBe(true);
    expect(privacySignalOn({ doNotTrack: 'yes' })).toBe(true);
    expect(privacySignalOn({ doNotTrack: '0' })).toBe(false);
    expect(privacySignalOn({ doNotTrack: null })).toBe(false);
    expect(privacySignalOn({})).toBe(false);
    expect(privacySignalOn(undefined)).toBe(false);
  });

  it('drops search and share events under a privacy signal and keeps operational ones', () => {
    const gpc = { globalPrivacyControl: true };
    expect(OPTIONAL_EVENT_KINDS).toEqual(['search', 'share']);
    expect(allowEvent('search', gpc)).toBe(false);
    expect(allowEvent('share', { doNotTrack: '1' })).toBe(false);
    for (const kind of ['view_start', 'progress', 'complete', 'error', 'vitals', 'startup', 'rebuffer', 'skip']) {
      expect(allowEvent(kind, gpc), kind).toBe(true);
    }
  });

  it('records search and share when no signal is set', () => {
    expect(allowEvent('search', {})).toBe(true);
    expect(allowEvent('share', undefined)).toBe(true);
  });
});
