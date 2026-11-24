import { describe, expect, it } from 'vitest';
import { chapterAt, chapterTicks, normalizeChapters } from './chapters';

const chapters = [
  { start: 0, title: 'Welcome' },
  { start: 60, title: 'Mixing colours' },
  { start: 180, title: 'Review' },
];

describe('chapterAt', () => {
  it('returns the chapter that contains a time', () => {
    expect(chapterAt(chapters, 0)).toEqual({ index: 0, title: 'Welcome' });
    expect(chapterAt(chapters, 59.9)).toEqual({ index: 0, title: 'Welcome' });
    expect(chapterAt(chapters, 60)).toEqual({ index: 1, title: 'Mixing colours' });
    expect(chapterAt(chapters, 500)).toEqual({ index: 2, title: 'Review' });
  });

  it('returns null before the first chapter and with no chapters', () => {
    expect(chapterAt([{ start: 10, title: 'Late' }], 5)).toBeNull();
    expect(chapterAt([], 5)).toBeNull();
  });
});

describe('chapterTicks', () => {
  it('gives tick positions as fractions of the duration, skipping the first chapter', () => {
    expect(chapterTicks(chapters, 240)).toEqual([0.25, 0.75]);
  });

  it('gives no ticks without a known duration or chapters', () => {
    expect(chapterTicks(chapters, Number.NaN)).toEqual([]);
    expect(chapterTicks([], 240)).toEqual([]);
  });
});

describe('normalizeChapters', () => {
  it('drops chapters at or past the duration', () => {
    expect(normalizeChapters(chapters, 180).map((c) => c.title)).toEqual([
      'Welcome',
      'Mixing colours',
    ]);
  });

  it('keeps every chapter while the duration is not known', () => {
    expect(normalizeChapters(chapters, Number.NaN)).toHaveLength(3);
  });

  it('sorts and removes duplicate starts', () => {
    const out = normalizeChapters(
      [
        { start: 60, title: 'B' },
        { start: 0, title: 'A' },
        { start: 60, title: 'B again' },
      ],
      600,
    );
    expect(out).toEqual([
      { start: 0, title: 'A' },
      { start: 60, title: 'B' },
    ]);
  });

  it('drops empty titles and invalid starts', () => {
    expect(
      normalizeChapters(
        [
          { start: -1, title: 'x' },
          { start: 5, title: '  ' },
        ],
        600,
      ),
    ).toEqual([]);
  });
});
