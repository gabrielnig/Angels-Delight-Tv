import { describe, expect, it, vi } from 'vitest';
import {
  createMessages as createTyped,
  formatDuration,
  formatNumber,
  msg,
  type CatalogShape,
} from './messages';
import { EN_NG } from './en-ng';

// These tests use ad hoc catalogs, so the key type is widened to string.
const createMessages = (...args: Parameters<typeof createTyped>) =>
  createTyped(...args) as unknown as (
    key: string,
    params?: Record<string, string | number>,
  ) => string;

describe('createMessages', () => {
  const en: CatalogShape = {
    'a.plain': 'Hello',
    'a.param': 'Resumed from {time}',
    'a.count': { one: '{count} minute', other: '{count} minutes' },
  };

  it('returns plain text and fills named params', () => {
    const t = createMessages('en-NG', { 'en-NG': en });
    expect(t('a.plain')).toBe('Hello');
    expect(t('a.param', { time: '1:05' })).toBe('Resumed from 1:05');
  });

  it('picks the plural form by count and formats the number by locale', () => {
    const t = createMessages('en-NG', { 'en-NG': en });
    expect(t('a.count', { count: 1 })).toBe('1 minute');
    expect(t('a.count', { count: 2 })).toBe('2 minutes');
    expect(t('a.count', { count: 1500 })).toBe('1,500 minutes');
  });

  it('falls back to English for a key missing in the locale and logs it once', () => {
    const onMissing = vi.fn();
    const t = createMessages('fr', { 'en-NG': en, fr: { 'a.plain': 'Bonjour' } }, onMissing);
    expect(t('a.plain')).toBe('Bonjour');
    expect(t('a.param', { time: '2' })).toBe('Resumed from 2');
    t('a.param', { time: '3' });
    expect(onMissing).toHaveBeenCalledTimes(1);
    expect(onMissing).toHaveBeenCalledWith('a.param', 'fr');
  });

  it('returns the key and logs when no catalog has it', () => {
    const onMissing = vi.fn();
    const t = createMessages('en-NG', { 'en-NG': en }, onMissing);
    expect(t('nope')).toBe('nope');
    expect(onMissing).toHaveBeenCalledWith('nope', 'en-NG');
  });

  it('leaves a placeholder without a param visible instead of printing undefined', () => {
    const t = createMessages('en-NG', { 'en-NG': en });
    expect(t('a.param')).toBe('Resumed from {time}');
  });
});

describe('locale formatting', () => {
  it('formats durations as short text', () => {
    expect(formatDuration(6)).toBe('6 min');
    expect(formatDuration(60)).toBe('1 hr');
    expect(formatDuration(220)).toBe('3 hr 40 min');
  });
  it('formats numbers with the en-NG grouping', () => {
    expect(formatNumber(1234567)).toBe('1,234,567');
  });
});

describe('the English catalog', () => {
  it('has no empty text and balanced placeholders', () => {
    for (const [key, value] of Object.entries(EN_NG)) {
      const forms = typeof value === 'string' ? [value] : Object.values(value);
      for (const text of forms) {
        expect(text.trim(), key).not.toBe('');
        expect(text.split('{').length, key).toBe(text.split('}').length);
        expect(text, key).not.toMatch(/[–—]/);
      }
    }
  });
  it('keeps the shipped copy word for word', () => {
    expect(msg('auth.error.generic')).toBe('Something went wrong. Please try again.');
    expect(msg('player.resumed', { time: '2:10' })).toBe('Resumed from 2:10');
  });
});
