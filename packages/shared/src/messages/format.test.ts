import { describe, expect, it } from 'vitest';
import { formatDate, formatDuration, formatNumber, pluralCategory } from './format';
import { createMessages } from './messages';

describe('pluralCategory', () => {
  it('uses Intl.PluralRules for the locale', () => {
    expect(pluralCategory('en', 1)).toBe('one');
    expect(pluralCategory('en', 2)).toBe('other');
    expect(pluralCategory('yo', 1)).toBe(new Intl.PluralRules('yo-NG').select(1));
    expect(pluralCategory('ha', 1)).toBe(new Intl.PluralRules('ha-NG').select(1));
  });
  it('falls back to English rules when the engine has no data', () => {
    expect(pluralCategory('pcm', 1)).toBe('one');
    expect(pluralCategory('pcm', 5)).toBe('other');
  });
});

describe('formatNumber and formatDate', () => {
  it('formats numbers and falls back to en-NG when the locale has no data', () => {
    expect(formatNumber(1500)).toBe('1,500');
    expect(formatNumber(1500, 'pcm')).toBe('1,500');
  });
  it('gives 17 Nov 2026 for en and falls back to en-NG for a locale the engine does not know', () => {
    const d = new Date(Date.UTC(2026, 10, 17, 12));
    expect(formatDate(d, 'en')).toBe('17 Nov 2026');
    expect(formatDate(d, 'xx-unknown')).toBe('17 Nov 2026');
  });
});

describe('formatDuration', () => {
  it('keeps 6 min, 1 hr and 3 hr 40 min for en', () => {
    expect(formatDuration(6)).toBe('6 min');
    expect(formatDuration(60)).toBe('1 hr');
    expect(formatDuration(220)).toBe('3 hr 40 min');
  });
  it('reads min and hr from the catalog for a locale', () => {
    const t = createMessages('yo', {
      'en-NG': {
        'format.duration.min': '{count} min',
        'format.duration.hr': '{count} hr',
        'format.duration.hrMin': '{hours} hr {minutes} min',
      },
      yo: {
        'format.duration.min': '{count} ìṣ',
        'format.duration.hr': '{count} wákàtí',
        'format.duration.hrMin': '{hours} wákàtí {minutes} ìṣ',
      },
    }) as unknown as Parameters<typeof formatDuration>[1];
    expect(formatDuration(6, t)).toBe('6 ìṣ');
    expect(formatDuration(60, t)).toBe('1 wákàtí');
    expect(formatDuration(220, t)).toBe('3 wákàtí 40 ìṣ');
  });
});
