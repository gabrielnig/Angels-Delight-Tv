import { describe, expect, it } from 'vitest';
import { validateVideoPatch } from '@/lib/data/admin/video-commands';
import {
  EMPTY_DETAILS,
  resolveDetails,
  summarizeDetails,
  toVideoPatch,
  validateDetails,
  type UploadDetails,
} from './upload-details';

const shared: UploadDetails = {
  ...EMPTY_DETAILS,
  categoryIds: ['c1', 'c2'],
  seriesId: 's1',
  numberEpisodes: true,
  startEpisode: 3,
  suitability: 'everyone',
  tags: ['maths'],
};

describe('resolveDetails', () => {
  it('merges shared details with a file override, field by field', () => {
    const out = resolveDetails(shared, { suitability: 'kids', title: 'Fractions' }, 0)!;
    expect(out.suitability).toBe('kids');
    expect(out.title).toBe('Fractions');
    expect(out.categoryIds).toEqual(['c1', 'c2']);
    expect(out.seriesId).toBe('s1');
  });

  it('numbers episodes in file order starting at the chosen number', () => {
    expect([0, 1, 2].map((i) => resolveDetails(shared, undefined, i)!.episodeNumber)).toEqual([3, 4, 5]);
  });

  it('leaves the episode number out when numbering is off or there is no series', () => {
    expect(resolveDetails({ ...shared, numberEpisodes: false }, undefined, 1)!.episodeNumber).toBeNull();
    expect(resolveDetails({ ...shared, seriesId: null }, undefined, 1)!.episodeNumber).toBeNull();
  });

  it('an override episode number wins over auto numbering', () => {
    expect(resolveDetails(shared, { episodeNumber: 9 }, 1)!.episodeNumber).toBe(9);
  });

  it('never applies to a replace upload', () => {
    expect(resolveDetails(shared, undefined, 0, { replace: true })).toBeNull();
  });
});

describe('validateDetails', () => {
  it('drops unknown category and series ids and says so', () => {
    const out = validateDetails(
      { ...shared, categoryIds: ['c1', 'gone'], seriesId: 'missing' },
      new Set(['c1', 'c2']),
      new Set(['s1']),
    );
    expect(out.details.categoryIds).toEqual(['c1']);
    expect(out.details.seriesId).toBeNull();
    expect(out.errors).toEqual(['Some categories no longer exist and were dropped.', 'That series no longer exists and was dropped.']);
  });

  it('keeps valid details untouched with no errors', () => {
    const out = validateDetails(shared, new Set(['c1', 'c2']), new Set(['s1']));
    expect(out.details).toEqual(shared);
    expect(out.errors).toEqual([]);
  });
});

describe('summarizeDetails', () => {
  it('names the count and the choices', () => {
    const text = summarizeDetails(
      shared,
      8,
      [
        { id: 'c1', name: 'Science' },
        { id: 'c2', name: 'Maths' },
      ],
      [{ id: 's1', title: 'Series X' }],
    );
    expect(text).toBe('Details for all 8 files: Science and Maths, Series X, Everyone, 1 tag.');
  });

  it('says when nothing is set', () => {
    expect(summarizeDetails(EMPTY_DETAILS, 1, [], [])).toBe('Details for this file: none set.');
  });
});

describe('toVideoPatch', () => {
  it('makes a patch the video service accepts, leaving out blanks', () => {
    expect(toVideoPatch(resolveDetails(shared, { title: 'Fractions' }, 1)!)).toEqual({
      title: 'Fractions',
      categoryIds: ['c1', 'c2'],
      suitability: 'everyone',
      tags: ['maths'],
      seriesId: 's1',
      episodeNumber: 4,
    });
    expect(toVideoPatch(resolveDetails(EMPTY_DETAILS, undefined, 0)!)).toEqual({});
  });

  it('passes the video editor validation, and a vanished category is refused there too', () => {
    const patch = toVideoPatch(resolveDetails(shared, { title: 'Fractions' }, 0)!);
    expect(validateVideoPatch(patch, new Set(['c1', 'c2'])).ok).toBe(true);
    const bad = validateVideoPatch(patch, new Set(['c1']));
    expect(bad.ok).toBe(false);
  });
});
