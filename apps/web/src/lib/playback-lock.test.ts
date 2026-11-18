import { describe, expect, it } from 'vitest';
import { withoutKidsLocked } from './playback-lock';

describe('withoutKidsLocked', () => {
  it('drops the settings a parent account controls on a Kids profile', () => {
    expect(withoutKidsLocked({ autoplayNext: false, dataSaver: false, quality: '720' }, true)).toEqual({
      quality: '720',
    });
  });

  it('keeps everything on an adult profile', () => {
    const patch = { autoplayNext: false, dataSaver: true };
    expect(withoutKidsLocked(patch, false)).toEqual(patch);
  });
});
