import { describe, expect, it } from 'vitest';
import { LOW_FRAME_SCORE, allFramesLow } from './frame-score';

describe('allFramesLow', () => {
  it('is true only when every scored frame is below the threshold', () => {
    expect(allFramesLow([10, 20, LOW_FRAME_SCORE - 1])).toBe(true);
    expect(allFramesLow([10, 20, LOW_FRAME_SCORE])).toBe(false);
    expect(allFramesLow([90, 5])).toBe(false);
  });
  it('is false with nothing scored, so an old video without scores shows no warning', () => {
    expect(allFramesLow([])).toBe(false);
    expect(allFramesLow([null, null])).toBe(false);
  });
  it('ignores frames with no score', () => {
    expect(allFramesLow([null, 3])).toBe(true);
  });
});
