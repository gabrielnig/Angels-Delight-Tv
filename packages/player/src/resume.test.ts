import { describe, expect, it } from 'vitest';
import { computeStartPosition } from './resume';

describe('computeStartPosition', () => {
  it('starts at saved position minus 3 seconds', () => {
    expect(computeStartPosition({ saved: 134, duration: 352 })).toEqual({
      start: 131,
      source: 'saved',
      resumedFrom: 134,
    });
  });
  it('ignores a saved position under 5 seconds', () => {
    expect(computeStartPosition({ saved: 4, duration: 352 })).toEqual({
      start: 0,
      source: 'none',
      resumedFrom: null,
    });
  });
  it('resumes at exactly 5 seconds, clamped to zero after the rewind', () => {
    expect(computeStartPosition({ saved: 5, duration: 352 }).start).toBe(2);
    expect(computeStartPosition({ saved: 5, duration: 352, rewind: 10 }).start).toBe(0);
  });
  it('lets ?t override the saved position without a resume toast', () => {
    expect(computeStartPosition({ urlT: 90, saved: 134, duration: 352 })).toEqual({
      start: 90,
      source: 'url',
      resumedFrom: null,
    });
  });
  it('ignores a saved position beyond the duration', () => {
    expect(computeStartPosition({ saved: 400, duration: 352 }).start).toBe(0);
  });
  it('ignores an out of range ?t and falls back to saved', () => {
    expect(computeStartPosition({ urlT: 9999, saved: 134, duration: 352 }).source).toBe('saved');
    expect(computeStartPosition({ urlT: -3, saved: null, duration: 352 }).source).toBe('none');
    expect(computeStartPosition({ urlT: Number.NaN, saved: null }).source).toBe('none');
  });
  it('trusts saved when duration is unknown', () => {
    expect(computeStartPosition({ saved: 100 }).start).toBe(97);
  });
  it('starts over when the video was finished', () => {
    expect(computeStartPosition({ saved: 350, duration: 352, finished: true }).start).toBe(0);
  });
  it('handles a missing saved position', () => {
    expect(computeStartPosition({ saved: null, duration: 352 }).start).toBe(0);
  });
});
