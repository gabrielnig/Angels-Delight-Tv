import { describe, expect, it } from 'vitest';
import { STREAK_KEY, createAutoplayStreak } from './autoplay-streak';

function memory(initial: Record<string, string> = {}) {
  const data = { ...initial };
  return {
    data,
    getItem: (k: string) => data[k] ?? null,
    setItem: (k: string, v: string) => void (data[k] = v),
  };
}

describe('autoplay streak (L4-08)', () => {
  it('lives under ad:autoplay-streak in session storage terms and starts at zero', () => {
    expect(STREAK_KEY).toBe('ad:autoplay-streak');
    expect(createAutoplayStreak(memory()).get()).toBe(0);
  });

  it('keeps the count between page loads', () => {
    const store = memory();
    createAutoplayStreak(store).set(2);
    expect(createAutoplayStreak(store).get()).toBe(2);
  });

  it('treats corrupt or negative values as zero', () => {
    expect(createAutoplayStreak(memory({ [STREAK_KEY]: 'x' })).get()).toBe(0);
    expect(createAutoplayStreak(memory({ [STREAK_KEY]: '-3' })).get()).toBe(0);
    expect(createAutoplayStreak(memory({ [STREAK_KEY]: '2.5' })).get()).toBe(0);
  });

  it('works in memory when storage is blocked', () => {
    const streak = createAutoplayStreak(null);
    streak.set(2);
    expect(streak.get()).toBe(2);
    const blocked = createAutoplayStreak({
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    });
    blocked.set(1);
    expect(blocked.get()).toBe(1);
  });
});
