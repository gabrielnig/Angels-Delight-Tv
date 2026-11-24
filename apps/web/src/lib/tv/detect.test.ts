import { describe, expect, it } from 'vitest';
import { isTvBrowser, parseTvPreference, resolveTvMode, TV_COOKIE } from './detect';

const TV = {
  tizen:
    'Mozilla/5.0 (SMART-TV; LINUX; Tizen 6.0) AppleWebKit/537.36 (KHTML, like Gecko) 76.0.3809.146/6.0 TV Safari/537.36',
  webos:
    'Mozilla/5.0 (Web0S; Linux/SmartTV) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/79.0.3945.79 Safari/537.36 WebAppManager',
  webosUpper:
    'Mozilla/5.0 (WebOS; Linux/SmartTV) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/68.0.3440.106 Safari/537.36',
  fireTv:
    'Mozilla/5.0 (Linux; Android 9; AFTMM Build/PS7233) AppleWebKit/537.36 (KHTML, like Gecko) Silk/98.3.1 like Chrome/98.0.4758.136 Safari/537.36',
  fireStick:
    'Mozilla/5.0 (Linux; Android 7.1.2; AFTT Build/NS6265) AppleWebKit/537.36 (KHTML, like Gecko) Silk/91.2.1 like Chrome/91.0.4472.88 Safari/537.36',
  chromecast:
    'Mozilla/5.0 (X11; Linux armv7l) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/88.0.4324.188 Safari/537.36 CrKey/1.56.500000',
  androidTv:
    'Mozilla/5.0 (Linux; Android 11; Android TV Build/RTT2.200503.001) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.4896.127 Safari/537.36',
  hisense:
    'Mozilla/5.0 (Linux; Android 9; Hisense H55A6100 Build/PPR1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/80.0.3987.162 Safari/537.36',
  vidaa:
    'Mozilla/5.0 (Linux; VIDAA 4.0; HZ55A6100) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/72.0.3626.121 Safari/537.36 VIDAA',
  smartTv:
    'Mozilla/5.0 (Linux; U; Android 4.2.2; en-us; SmartTV Build/JDQ39) AppleWebKit/534.30 (KHTML, like Gecko) Version/4.0 Safari/534.30',
};

const NOT_TV = {
  iphone:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1',
  androidPhone:
    'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
  samsungPhone:
    'Mozilla/5.0 (Linux; Android 13; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/21.0 Chrome/110.0.5481.154 Mobile Safari/537.36',
  windows:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  mac: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
  tabletWithAftWord:
    'Mozilla/5.0 (Linux; Android 12; SM-X200) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 AFTER',
};

describe('isTvBrowser', () => {
  it.each(Object.entries(TV))('recognises %s', (_name, ua) => {
    expect(isTvBrowser(ua)).toBe(true);
  });

  it.each(Object.entries(NOT_TV))('does not take %s for a TV', (_name, ua) => {
    expect(isTvBrowser(ua)).toBe(false);
  });

  it('treats a missing user agent as not a TV', () => {
    expect(isTvBrowser(null)).toBe(false);
    expect(isTvBrowser(undefined)).toBe(false);
    expect(isTvBrowser('')).toBe(false);
  });
});

describe('TV preference', () => {
  it('parses auto, on and off and falls back to auto', () => {
    expect(parseTvPreference('on')).toBe('on');
    expect(parseTvPreference('off')).toBe('off');
    expect(parseTvPreference('auto')).toBe('auto');
    expect(parseTvPreference('maybe')).toBe('auto');
    expect(parseTvPreference(undefined)).toBe('auto');
    expect(parseTvPreference(null)).toBe('auto');
  });

  it('stored preference beats the user agent', () => {
    expect(resolveTvMode('on', NOT_TV.windows)).toBe(true);
    expect(resolveTvMode('off', TV.tizen)).toBe(false);
  });

  it('auto follows the user agent', () => {
    expect(resolveTvMode('auto', TV.webos)).toBe(true);
    expect(resolveTvMode('auto', NOT_TV.iphone)).toBe(false);
  });

  it('names its cookie', () => {
    expect(TV_COOKIE).toBe('ad_tv');
  });
});
