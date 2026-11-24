import { describe, expect, it } from 'vitest';
import { LOCALES, normalizeLocale, parseAcceptLanguage, pickLocale } from './locales';

describe('LOCALES', () => {
  it('lists en, yo, ig, ha and pcm with endonyms and html lang', () => {
    expect(LOCALES.map((l) => l.code)).toEqual(['en', 'yo', 'ig', 'ha', 'pcm']);
    const yo = LOCALES.find((l) => l.code === 'yo');
    expect(yo?.endonym).toBe('Yorùbá');
    expect(yo?.htmlLang).toBe('yo');
    expect(LOCALES.find((l) => l.code === 'en')?.htmlLang).toBe('en-NG');
    expect(LOCALES.find((l) => l.code === 'pcm')?.endonym).toBe('Naijá');
  });
});

describe('normalizeLocale', () => {
  it('maps yo-NG, ha-Latn-NG and EN-gb to codes', () => {
    expect(normalizeLocale('yo-NG')).toBe('yo');
    expect(normalizeLocale('ha-Latn-NG')).toBe('ha');
    expect(normalizeLocale('EN-gb')).toBe('en');
    expect(normalizeLocale('pcm')).toBe('pcm');
  });
  it('rejects unknown codes and input over 35 characters', () => {
    expect(normalizeLocale('fr')).toBeNull();
    expect(normalizeLocale('')).toBeNull();
    expect(normalizeLocale(`yo-${'x'.repeat(40)}`)).toBeNull();
    expect(normalizeLocale(undefined)).toBeNull();
  });
});

describe('parseAcceptLanguage', () => {
  it('orders by q and ignores malformed tags', () => {
    expect(parseAcceptLanguage('ha;q=0.5, yo-NG;q=0.9, en;q=0.1')).toEqual(['yo', 'ha', 'en']);
    expect(parseAcceptLanguage('fr, ;q=2, yo;q=abc, ig;q=0')).toEqual(['yo']);
    expect(parseAcceptLanguage(null)).toEqual([]);
  });
});

describe('pickLocale', () => {
  it('returns the first enabled match and else the default', () => {
    expect(pickLocale(['ha', 'yo'], ['en', 'yo'], 'en')).toBe('yo');
    expect(pickLocale(['ha'], ['en', 'yo'], 'en')).toBe('en');
    expect(pickLocale([], ['en'], 'en')).toBe('en');
  });
});
