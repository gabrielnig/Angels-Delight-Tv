import { describe, expect, it } from 'vitest';
import { audienceOf } from './profiles';

describe('audienceOf', () => {
  it('maps kids to rank 0 and an adult to its limit', () => {
    expect(audienceOf({ isKids: true, maxMaturityRank: 0 })).toEqual({ kids: true, maxRank: 0 });
    expect(audienceOf({ isKids: true, maxMaturityRank: 3 })).toEqual({ kids: true, maxRank: 0 });
    expect(audienceOf({ isKids: false, maxMaturityRank: 2 })).toEqual({ kids: false, maxRank: 2 });
    expect(audienceOf({ isKids: false, maxMaturityRank: 4 })).toEqual({ kids: false, maxRank: 4 });
  });

  it('clamps a bad limit instead of widening it', () => {
    expect(audienceOf({ isKids: false, maxMaturityRank: 9 })).toEqual({ kids: false, maxRank: 4 });
    expect(audienceOf({ isKids: false, maxMaturityRank: -3 })).toEqual({ kids: false, maxRank: 0 });
  });
});
