import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SERIES_LABELS,
  SERIES_PRESETS,
  effectiveSeriesLabels,
  groupName,
  itemCode,
  itemName,
  itemWord,
  groupWord,
  positionCode,
  positionLong,
  groupSummary,
  groupCount,
  itemCount,
  itemInSentence,
  groupInSentence,
  resolveSeriesLabels,
  validateSeriesLabels,
} from './series-labels';

const defaults = resolveSeriesLabels(DEFAULT_SERIES_LABELS, null);

describe('default labels read exactly as before', () => {
  it('uses Season, Episode and the E prefix', () => {
    expect(groupName(defaults, 2)).toBe('Season 2');
    expect(itemName(defaults, 4)).toBe('Episode 4');
    expect(itemCode(defaults, 4)).toBe('E4');
    expect(positionCode(defaults, 1, 4)).toBe('S1 E4');
    expect(positionLong(defaults, 1, 4)).toBe('Season 1, Episode 4');
  });

  it('pluralises with sentence case words', () => {
    expect(groupSummary(defaults, 1, 1)).toBe('Season 1, 1 episode');
    expect(groupSummary(defaults, 2, 8)).toBe('Season 2, 8 episodes');
    expect(groupWord(defaults, 3)).toBe('Seasons');
    expect(itemWord(defaults, 1)).toBe('Episode');
  });
});

describe('presets', () => {
  it('lists the five presets', () => {
    expect(SERIES_PRESETS).toEqual([
      'season_episode',
      'book_chapter',
      'part_lesson',
      'module_lesson',
      'custom',
    ]);
  });

  it('book and chapter', () => {
    const w = resolveSeriesLabels({ preset: 'book_chapter' }, null);
    expect(groupName(w, 1)).toBe('Book 1');
    expect(itemCode(w, 12)).toBe('Ch12');
    expect(positionCode(w, 1, 12)).toBe('B1 Ch12');
    expect(groupSummary(w, 1, 50)).toBe('Book 1, 50 chapters');
  });

  it('part and lesson, module and lesson', () => {
    expect(itemCode(resolveSeriesLabels({ preset: 'part_lesson' }, null), 3)).toBe('L3');
    expect(groupName(resolveSeriesLabels({ preset: 'module_lesson' }, null), 2)).toBe('Module 2');
  });

  it('an explicit code replaces the preset code', () => {
    const w = resolveSeriesLabels({ preset: 'book_chapter', code: 'C' }, null);
    expect(itemCode(w, 5)).toBe('C5');
  });
});

describe('custom words and the series override', () => {
  const custom = {
    preset: 'custom' as const,
    custom: {
      group: { one: 'Volume', other: 'Volumes' },
      item: { one: 'Study', other: 'Studies' },
    },
    code: 'St',
  };

  it('shows typed words as typed and uses the plural form for counts other than one', () => {
    const w = resolveSeriesLabels(custom, null);
    expect(groupName(w, 3)).toBe('Volume 3');
    expect(groupSummary(w, 3, 1)).toBe('Volume 3, 1 Study');
    expect(groupSummary(w, 3, 0)).toBe('Volume 3, 0 Studies');
    expect(itemCode(w, 2)).toBe('St2');
    expect(positionCode(w, 3, 2)).toBe('V3 St2');
  });

  it('a series override wins over the site default', () => {
    const w = resolveSeriesLabels({ preset: 'book_chapter' }, custom);
    expect(itemName(w, 1)).toBe('Study 1');
  });

  it('a group title wins over the numbered name', () => {
    expect(groupName(defaults, 1, 'Genesis')).toBe('Genesis');
    expect(groupName(defaults, 1, '  ')).toBe('Season 1');
  });
});

describe('validation', () => {
  const ok = {
    preset: 'custom',
    custom: { group: { one: 'Part', other: 'Parts' }, item: { one: 'Talk', other: 'Talks' } },
    code: 'T',
  };

  it('accepts a good value', () => {
    expect(validateSeriesLabels(ok)).toEqual({ ok: true, value: ok });
  });

  it('accepts a preset alone and trims', () => {
    expect(validateSeriesLabels({ preset: 'part_lesson', code: ' L ' })).toEqual({
      ok: true,
      value: { preset: 'part_lesson', code: 'L' },
    });
  });

  it('refuses an unknown preset', () => {
    expect(validateSeriesLabels({ preset: 'nope' }).ok).toBe(false);
  });

  it('custom needs all four words', () => {
    const bad = validateSeriesLabels({
      preset: 'custom',
      custom: { group: { one: 'Part', other: '' }, item: { one: 'Talk', other: 'Talks' } },
    });
    expect(bad).toMatchObject({ ok: false });
    if (!bad.ok) expect(bad.errors['custom.group.other']).toMatch(/Enter/);
  });

  it('refuses long words, markup, dashes and emoji', () => {
    const word = (one: string) => ({
      preset: 'custom',
      custom: { group: { one, other: 'Parts' }, item: { one: 'Talk', other: 'Talks' } },
    });
    expect(validateSeriesLabels(word('x'.repeat(25))).ok).toBe(false);
    expect(validateSeriesLabels(word('<b>Part</b>')).ok).toBe(false);
    expect(validateSeriesLabels(word(`Part${String.fromCharCode(0x2013)}One`)).ok).toBe(false);
    expect(validateSeriesLabels(word('Part \u{1F600}')).ok).toBe(false);
  });

  it('refuses a code that is long or has spaces', () => {
    expect(validateSeriesLabels({ preset: 'season_episode', code: 'ABCDE' }).ok).toBe(false);
    expect(validateSeriesLabels({ preset: 'season_episode', code: 'A B' }).ok).toBe(false);
  });

  it('an empty override value is null', () => {
    expect(validateSeriesLabels(null)).toEqual({ ok: true, value: null });
  });
});

describe('effectiveSeriesLabels', () => {
  it('prefers a valid override, then a valid site value, then the default', () => {
    expect(effectiveSeriesLabels({ preset: 'book_chapter' }, { preset: 'part_lesson' })).toEqual({
      preset: 'part_lesson',
    });
    expect(effectiveSeriesLabels({ preset: 'book_chapter' }, null)).toEqual({
      preset: 'book_chapter',
    });
    expect(effectiveSeriesLabels(undefined, undefined)).toEqual({ preset: 'season_episode' });
  });

  it('ignores stored values that fail validation', () => {
    expect(effectiveSeriesLabels({ preset: 'book_chapter' }, { preset: 'custom' })).toEqual({
      preset: 'book_chapter',
    });
    expect(effectiveSeriesLabels('junk', 42)).toEqual({ preset: 'season_episode' });
  });
});

describe('counts', () => {
  it('reads like a badge: 1 episode, 8 episodes, 3 seasons', () => {
    expect(itemCount(defaults, 1)).toBe('1 episode');
    expect(itemCount(defaults, 8)).toBe('8 episodes');
    expect(groupCount(defaults, 1)).toBe('1 season');
    expect(groupCount(defaults, 3)).toBe('3 seasons');
  });

  it('keeps typed words as typed', () => {
    const w = resolveSeriesLabels(
      {
        preset: 'custom',
        custom: {
          group: { one: 'Volume', other: 'Volumes' },
          item: { one: 'Study', other: 'Studies' },
        },
      },
      null,
    );
    expect(itemCount(w, 2)).toBe('2 Studies');
    expect(groupCount(w, 1)).toBe('1 Volume');
  });
});

describe('words inside a sentence', () => {
  it('lowercases preset words and keeps typed words', () => {
    expect(itemInSentence(defaults, 1)).toBe('episode');
    expect(groupInSentence(defaults, 2)).toBe('seasons');
    const w = resolveSeriesLabels(
      { preset: 'custom', custom: { group: { one: 'Volume', other: 'Volumes' }, item: { one: 'Study', other: 'Studies' } } },
      null,
    );
    expect(itemInSentence(w, 2)).toBe('Studies');
  });
});
