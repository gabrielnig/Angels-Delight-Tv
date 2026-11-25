import { beforeEach, describe, expect, it } from 'vitest';
import { createFixtureHelpProgress, summarizeProgress, WATCHED_AT } from './help-progress';

const a = { accountId: 'acc_a', role: 'editor' as const, name: 'A' };
const b = { accountId: 'acc_b', role: 'editor' as const, name: 'B' };

describe('help progress service (fixture)', () => {
  let s: ReturnType<typeof createFixtureHelpProgress>;
  beforeEach(() => {
    s = createFixtureHelpProgress();
  });

  it('marks a guide done and not done, per account', async () => {
    await s.setGuideDone(a, 'D02', true);
    expect((await s.read(a)).D02?.done).toBe(true);
    expect((await s.read(b)).D02).toBeUndefined();
    await s.setGuideDone(a, 'D02', false);
    expect((await s.read(a)).D02?.done).toBe(false);
  });

  it('marks a video watched and keeps the helpful answer, changeable', async () => {
    await s.markVideoWatched(a, 'D02');
    await s.setHelpful(a, 'D02', true);
    await s.setHelpful(a, 'D02', false);
    expect(await s.read(a)).toEqual({ D02: { done: false, watched: true, helpful: false } });
  });

  it('refuses an id that is not a guide id', async () => {
    await expect(s.setGuideDone(a, 'nope', true)).rejects.toThrow(/guide/i);
  });
});

describe('summarizeProgress', () => {
  it('counts finished guides and watched videos against what the person can see', () => {
    const rows = {
      D02: { done: true, watched: true, helpful: null },
      D07: { done: false, watched: true, helpful: null },
      X99: { done: true, watched: false, helpful: null },
    };
    const out = summarizeProgress(rows, { guides: ['D02', 'D07', 'S04'], videos: ['D02', 'D07'] });
    expect(out).toEqual({ guidesDone: 1, guidesTotal: 3, videosWatched: 2, videosTotal: 2 });
  });
  it('counts a video as watched at 90 percent', () => {
    expect(WATCHED_AT).toBe(0.9);
  });
});
