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

describe('loadedRules', () => {
  it('layers rules read from settings over the defaults and survives a failing read', async () => {
    const { loadedRules } = await import('./context');
    const base = { rules: { popularMinViews: 9 } } as never;
    expect((await loadedRules(base)).popularMinViews).toBe(9);
    const withLoader = { rules: { popularMinViews: 9 }, loadRules: async () => ({ popularMinViews: 7, topTenSize: 6 }) } as never;
    const got = await loadedRules(withLoader);
    expect([got.popularMinViews, got.topTenSize]).toEqual([7, 6]);
    const broken = { loadRules: async () => { throw new Error('db down'); } } as never;
    expect((await loadedRules(broken)).popularMinViews).toBe(5);
  });
});
