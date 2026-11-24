import { ValidationFailed } from '@ad/shared';
import { describe, expect, it } from 'vitest';
import {
  parseChapterText,
  parseClock,
  validateChapters,
  validateMarkers,
  type MarkerInput,
} from './validate';

const DURATION = 600_000;

function fieldsOf(fn: () => unknown): Record<string, string[]> {
  try {
    fn();
  } catch (error) {
    if (error instanceof ValidationFailed) return error.fields;
    throw error;
  }
  throw new Error('expected a ValidationFailed');
}

describe('validateMarkers', () => {
  it('accepts an intro that ends after it starts', () => {
    const out = validateMarkers([{ kind: 'intro', startMs: 12_000, endMs: 48_000 }], DURATION);
    expect(out).toEqual([{ kind: 'intro', startMs: 12_000, endMs: 48_000 }]);
  });

  it('rejects an intro that ends before it starts', () => {
    const fields = fieldsOf(() =>
      validateMarkers([{ kind: 'intro', startMs: 30_000, endMs: 10_000 }], DURATION),
    );
    expect(fields.intro?.[0]).toMatch(/after it starts/);
  });

  it('rejects overlapping markers', () => {
    const fields = fieldsOf(() =>
      validateMarkers(
        [
          { kind: 'intro', startMs: 0, endMs: 60_000 },
          { kind: 'recap', startMs: 30_000, endMs: 90_000 },
        ],
        DURATION,
      ),
    );
    expect(fields.recap?.[0]).toMatch(/overlap/i);
  });

  it('rejects a marker past the video duration', () => {
    const fields = fieldsOf(() =>
      validateMarkers([{ kind: 'intro', startMs: 590_000, endMs: 620_000 }], DURATION),
    );
    expect(fields.intro?.[0]).toMatch(/past the end/);
  });

  it('treats credits with no end as ending at the video end', () => {
    const out = validateMarkers([{ kind: 'credits', startMs: 540_000, endMs: null }], DURATION);
    expect(out).toEqual([{ kind: 'credits', startMs: 540_000, endMs: null }]);
    const fields = fieldsOf(() =>
      validateMarkers(
        [
          { kind: 'credits', startMs: 540_000, endMs: null },
          { kind: 'recap', startMs: 500_000, endMs: 560_000 },
        ],
        DURATION,
      ),
    );
    expect(fields.recap?.[0] ?? fields.credits?.[0]).toMatch(/overlap/i);
  });

  it('rejects credits that start at or after the video end', () => {
    const fields = fieldsOf(() =>
      validateMarkers([{ kind: 'credits', startMs: 600_000, endMs: null }], DURATION),
    );
    expect(fields.credits?.[0]).toMatch(/past the end/);
  });

  it('rejects an intro shorter than 3 seconds', () => {
    const fields = fieldsOf(() =>
      validateMarkers([{ kind: 'intro', startMs: 1_000, endMs: 3_500 }], DURATION),
    );
    expect(fields.intro?.[0]).toMatch(/at least 3 seconds/);
  });

  it('requires an end for intro and recap', () => {
    const fields = fieldsOf(() =>
      validateMarkers([{ kind: 'recap', startMs: 1_000, endMs: null }], DURATION),
    );
    expect(fields.recap?.[0]).toMatch(/needs an end/);
  });

  it('rejects two markers of the same kind and unknown kinds', () => {
    const dup: MarkerInput[] = [
      { kind: 'intro', startMs: 0, endMs: 10_000 },
      { kind: 'intro', startMs: 20_000, endMs: 30_000 },
    ];
    expect(fieldsOf(() => validateMarkers(dup, DURATION)).intro?.[0]).toMatch(/only one/i);
    expect(() =>
      validateMarkers([{ kind: 'outro' as 'intro', startMs: 0, endMs: 10_000 }], DURATION),
    ).toThrow(ValidationFailed);
  });

  it('accepts markers when the duration is not known yet', () => {
    expect(validateMarkers([{ kind: 'intro', startMs: 0, endMs: 10_000 }], null)).toHaveLength(1);
  });
});

describe('validateChapters', () => {
  it('rejects a chapter list that does not start at zero', () => {
    const fields = fieldsOf(() =>
      validateChapters([{ startMs: 5_000, title: 'Start' }], DURATION),
    );
    expect(fields.chapters?.[0]).toMatch(/0:00/);
  });

  it('rejects chapters closer than 5 seconds', () => {
    const fields = fieldsOf(() =>
      validateChapters(
        [
          { startMs: 0, title: 'One' },
          { startMs: 4_000, title: 'Two' },
        ],
        DURATION,
      ),
    );
    expect(fields.chapters?.[0]).toMatch(/5 seconds apart/);
  });

  it('rejects more than 50 chapters', () => {
    const many = Array.from({ length: 51 }, (_, i) => ({ startMs: i * 10_000, title: `C${i}` }));
    const fields = fieldsOf(() => validateChapters(many, 1_000_000));
    expect(fields.chapters?.[0]).toMatch(/50 chapters/);
  });

  it('trims titles and rejects empty or over 60 character titles', () => {
    const out = validateChapters([{ startMs: 0, title: '  Mixing colours  ' }], DURATION);
    expect(out[0]?.title).toBe('Mixing colours');
    expect(fieldsOf(() => validateChapters([{ startMs: 0, title: '   ' }], DURATION)).chapters?.[0]).toMatch(
      /title/i,
    );
    expect(
      fieldsOf(() => validateChapters([{ startMs: 0, title: 'x'.repeat(61) }], DURATION)).chapters?.[0],
    ).toMatch(/60 characters/);
  });

  it('sorts by start time and rejects two chapters at the same time', () => {
    const out = validateChapters(
      [
        { startMs: 30_000, title: 'B' },
        { startMs: 0, title: 'A' },
      ],
      DURATION,
    );
    expect(out.map((c) => c.title)).toEqual(['A', 'B']);
    expect(() =>
      validateChapters(
        [
          { startMs: 0, title: 'A' },
          { startMs: 0, title: 'B' },
        ],
        DURATION,
      ),
    ).toThrow(ValidationFailed);
  });

  it('rejects a chapter at or past the video end', () => {
    const fields = fieldsOf(() =>
      validateChapters(
        [
          { startMs: 0, title: 'A' },
          { startMs: 600_000, title: 'B' },
        ],
        DURATION,
      ),
    );
    expect(fields.chapters?.[0]).toMatch(/past the end/);
  });

  it('accepts an empty list', () => {
    expect(validateChapters([], DURATION)).toEqual([]);
  });
});

describe('parseClock', () => {
  it('parses mm:ss and h:mm:ss', () => {
    expect(parseClock('0:12')).toBe(12_000);
    expect(parseClock('2:14')).toBe(134_000);
    expect(parseClock('1:02:03')).toBe(3_723_000);
    expect(parseClock(' 10:05 ')).toBe(605_000);
  });

  it('rejects 1:99 and other malformed times', () => {
    expect(parseClock('1:99')).toBeNull();
    expect(parseClock('abc')).toBeNull();
    expect(parseClock('')).toBeNull();
    expect(parseClock('1:2:3:4')).toBeNull();
    expect(parseClock('-1:00')).toBeNull();
  });
});

describe('parseChapterText', () => {
  it('parses pasted lines in mm:ss and h:mm:ss', () => {
    const out = parseChapterText('0:00 Intro\n2:14 Mixing colours\n1:05:00 Review');
    expect(out.errors).toEqual([]);
    expect(out.chapters).toEqual([
      { startMs: 0, title: 'Intro' },
      { startMs: 134_000, title: 'Mixing colours' },
      { startMs: 3_900_000, title: 'Review' },
    ]);
  });

  it('accepts a separator after the time and skips blank lines', () => {
    const out = parseChapterText('0:00 - Intro\n\n0:30: Next\r\n');
    expect(out.chapters.map((c) => c.title)).toEqual(['Intro', 'Next']);
  });

  it('reports line numbers for bad pasted lines', () => {
    const out = parseChapterText('0:00 Intro\nno time here\n1:99 Bad time\n2:00');
    expect(out.errors.map((e) => e.line)).toEqual([2, 3, 4]);
    expect(out.chapters).toHaveLength(1);
  });
});
