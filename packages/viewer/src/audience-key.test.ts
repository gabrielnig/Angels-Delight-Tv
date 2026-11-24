import { describe, expect, it } from 'vitest';
import { audienceKey } from './context';

describe('audienceKey', () => {
  it('gives kids one tier whatever the rank', () => {
    expect(audienceKey({ kids: true, maxRank: 0 })).toBe('kids');
    expect(audienceKey({ kids: true })).toBe('kids');
  });
  it('separates adult tiers by rank and defaults to the top rank', () => {
    expect(audienceKey({ kids: false, maxRank: 2 })).toBe('rank-2');
    expect(audienceKey({ kids: false })).toBe('rank-4');
    expect(audienceKey({ kids: false, maxRank: 2 })).not.toBe(audienceKey({ kids: false, maxRank: 4 }));
  });
});
