import { describe, expect, it } from 'vitest';
import { resolveLocale } from './resolve';

const base = { enabled: ['en', 'yo', 'ha', 'ig'], fallback: 'en' as const };

describe('resolveLocale', () => {
  it('query beats profile beats account beats cookie beats Accept-Language beats default', () => {
    const all = {
      ...base,
      query: 'ig',
      profileLanguage: 'ha',
      accountLocale: 'yo',
      cookie: 'en',
      acceptLanguage: 'yo',
    };
    expect(resolveLocale(all)).toBe('ig');
    expect(resolveLocale({ ...all, query: undefined })).toBe('ha');
    expect(resolveLocale({ ...all, query: undefined, profileLanguage: undefined })).toBe('yo');
    expect(
      resolveLocale({ ...all, query: undefined, profileLanguage: undefined, accountLocale: undefined }),
    ).toBe('en');
    expect(resolveLocale({ ...base, acceptLanguage: 'ha;q=0.8, yo;q=0.9' })).toBe('yo');
    expect(resolveLocale({ ...base, fallback: 'yo' })).toBe('yo');
  });
  it('a locale that is not enabled is skipped at every step', () => {
    const r = resolveLocale({
      enabled: ['en', 'yo'],
      fallback: 'en',
      query: 'ha',
      profileLanguage: 'ig',
      accountLocale: 'pcm',
      cookie: 'ha',
      acceptLanguage: 'ha, yo;q=0.5',
    });
    expect(r).toBe('yo');
  });
  it('a guest with no cookie gets the Accept-Language match', () => {
    expect(resolveLocale({ ...base, acceptLanguage: 'fr, ha;q=0.7' })).toBe('ha');
  });
  it('yo-NG and ha-Latn-NG resolve to yo and ha', () => {
    expect(resolveLocale({ ...base, cookie: 'yo-NG' })).toBe('yo');
    expect(resolveLocale({ ...base, acceptLanguage: 'ha-Latn-NG' })).toBe('ha');
  });
  it('no match falls to the site default', () => {
    expect(resolveLocale({ ...base, acceptLanguage: 'fr, de' })).toBe('en');
  });
  it('a kids profile uses its own language over the device cookie', () => {
    expect(resolveLocale({ ...base, profileLanguage: 'ha', cookie: 'yo' })).toBe('ha');
  });
  it('with only English enabled it is always English', () => {
    expect(resolveLocale({ enabled: ['en'], fallback: 'en', query: 'yo', cookie: 'ha' })).toBe('en');
  });
});
