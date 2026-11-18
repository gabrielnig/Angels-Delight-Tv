import { describe, expect, it } from 'vitest';
import {
  ALWAYS_ASK_COOKIE,
  alwaysAskFromCookie,
  pickerAutoSkip,
  rememberedProfile,
} from './always-ask';

describe('always ask who is watching (M03-S11)', () => {
  it('reads the device setting from its cookie', () => {
    expect(ALWAYS_ASK_COOKIE).toBe('ad_always_ask');
    expect(alwaysAskFromCookie('1')).toBe(true);
    expect(alwaysAskFromCookie('0')).toBe(false);
    expect(alwaysAskFromCookie(undefined)).toBe(false);
    expect(alwaysAskFromCookie('yes')).toBe(false);
  });

  it('skips the picker for a single profile only when the setting is off and nobody asked to switch', () => {
    expect(pickerAutoSkip({ alwaysAsk: false, switching: false })).toBe(true);
    expect(pickerAutoSkip({ alwaysAsk: true, switching: false })).toBe(false);
    expect(pickerAutoSkip({ alwaysAsk: false, switching: true })).toBe(false);
  });

  const profiles = [{ id: 'p1' }, { id: 'p2' }];
  it('opens the remembered profile while it still exists', () => {
    expect(rememberedProfile(profiles, 'p2')).toEqual({ id: 'p2' });
  });
  it('shows the picker when the remembered profile was deleted or nothing is remembered', () => {
    expect(rememberedProfile(profiles, 'gone')).toBeNull();
    expect(rememberedProfile(profiles, undefined)).toBeNull();
    expect(rememberedProfile(profiles, null)).toBeNull();
  });
});
