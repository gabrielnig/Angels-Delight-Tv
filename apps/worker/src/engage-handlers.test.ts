import { ENGAGE_CRON_SCHEDULES } from '@ad/queue';
import { FakeBoss, MemoryMirror } from '@ad/queue/testing';
import { createLogger } from '@ad/shared';
import { describe, expect, it } from 'vitest';
import { registerEngageHandlers } from './engage-handlers';

describe('registerEngageHandlers', () => {
  it('registers the ratings rollup, schedules it, and runs it when the queue fires, twice safely', async () => {
    let runs = 0;
    let refreshes = 0;
    const boss = new FakeBoss();
    await registerEngageHandlers(boss, {
      rollupRatings: async () => (runs++, { titles: 2, labelled: 1 }),
      refreshTrending: async () => (refreshes++, { trending: 5, popular: 3 }),
      mirror: new MemoryMirror(),
      logger: createLogger({ write: () => undefined }),
    });
    expect([...boss.handlers.keys()].sort()).toEqual(['ratings.rollup', 'trending.refresh']);
    expect(boss.schedules.map((s) => [s.name, s.cron, s.tz])).toEqual(
      ENGAGE_CRON_SCHEDULES.map((e) => [e.queue, e.cron, e.timezone]),
    );
    await boss.send('ratings.rollup', {});
    await boss.drain('ratings.rollup');
    await boss.send('ratings.rollup', {});
    await boss.drain('ratings.rollup');
    expect(runs).toBe(2);
    await boss.send('trending.refresh', {});
    await boss.drain('trending.refresh');
    expect(refreshes).toBe(1);
  });
});
