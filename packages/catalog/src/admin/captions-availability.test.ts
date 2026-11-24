import { describe, expect, it } from 'vitest';
import { effectiveCaptionsEnabled, validateAvailability, MIN_OFF_REASON } from './captions-availability';

describe('effectiveCaptionsEnabled', () => {
  it('null follows the site default', () => {
    expect(effectiveCaptionsEnabled({ captionsEnabled: null }, true)).toBe(true);
    expect(effectiveCaptionsEnabled({ captionsEnabled: null }, false)).toBe(false);
  });

  it('explicit on beats a site default of off', () => {
    expect(effectiveCaptionsEnabled({ captionsEnabled: true }, false)).toBe(true);
  });

  it('explicit off beats a site default of on', () => {
    expect(effectiveCaptionsEnabled({ captionsEnabled: false }, true)).toBe(false);
  });
});

describe('validateAvailability', () => {
  it('turning off without a reason is refused', () => {
    expect(validateAvailability(false, undefined)).toEqual({ ok: false, error: expect.stringMatching(/reason/i) });
    expect(validateAvailability(false, 'abcd')).toMatchObject({ ok: false });
    expect(validateAvailability(false, '     ')).toMatchObject({ ok: false });
  });

  it('turning off with a reason of 5 or more characters is accepted and trimmed', () => {
    expect(MIN_OFF_REASON).toBe(5);
    expect(validateAvailability(false, '  Sign language only  ')).toEqual({ ok: true, reason: 'Sign language only' });
  });

  it('on and follow default need no reason and clear it', () => {
    expect(validateAvailability(true, 'ignored')).toEqual({ ok: true, reason: null });
    expect(validateAvailability(null, undefined)).toEqual({ ok: true, reason: null });
  });
});
