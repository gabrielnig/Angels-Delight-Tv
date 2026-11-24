// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readTvPreference, setTvPreference, TV_EVENT } from './client';

const clearCookie = () => {
  document.cookie = 'ad_tv=; Path=/; Max-Age=0';
};

afterEach(() => {
  clearCookie();
  document.documentElement.removeAttribute('data-tv');
  vi.restoreAllMocks();
});

describe('TV preference on the client', () => {
  it('reads auto when there is no cookie', () => {
    expect(readTvPreference()).toBe('auto');
  });

  it('on sets the cookie, the attribute and fires the event', () => {
    const seen = vi.fn();
    window.addEventListener(TV_EVENT, seen);
    setTvPreference('on');
    expect(document.cookie).toContain('ad_tv=on');
    expect(document.documentElement.getAttribute('data-tv')).toBe('on');
    expect(readTvPreference()).toBe('on');
    expect(seen).toHaveBeenCalledTimes(1);
    window.removeEventListener(TV_EVENT, seen);
  });

  it('off clears the attribute even on a TV user agent', () => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Mozilla/5.0 (SMART-TV; Tizen 6.0)');
    setTvPreference('on');
    setTvPreference('off');
    expect(document.cookie).toContain('ad_tv=off');
    expect(document.documentElement.hasAttribute('data-tv')).toBe(false);
  });

  it('auto drops the cookie and follows the user agent', () => {
    setTvPreference('on');
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(
      'Mozilla/5.0 (Windows NT 10.0) Chrome/120',
    );
    setTvPreference('auto');
    expect(document.cookie).not.toContain('ad_tv=');
    expect(document.documentElement.hasAttribute('data-tv')).toBe(false);
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Mozilla/5.0 (Web0S; Linux/SmartTV)');
    setTvPreference('auto');
    expect(document.documentElement.getAttribute('data-tv')).toBe('on');
  });
});
