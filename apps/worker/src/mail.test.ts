import { MAIL_CRON_SCHEDULES } from '@ad/queue';
import { FakeBoss, MemoryMirror } from '@ad/queue/testing';
import { createLogger } from '@ad/shared';
import { describe, expect, it } from 'vitest';
import { registerMailHandlers } from './mail';

function setup(overrides: Record<string, unknown> = {}) {
  const calls: string[] = [];
  const logs: Array<[string, unknown]> = [];
  const deps = {
    queueImmediate: async () => (calls.push('immediate'), 2),
    drain: async () => (calls.push('drain'), { claimed: 3, sent: 2, retried: 1, failed: 0 }),
    prune: async () => (calls.push('prune'), 0),
    digests: async () => (calls.push('digests'), { queued: 4, skipped: 1 }),
    mirror: new MemoryMirror(),
    logger: {
      ...createLogger({ write: () => undefined }),
      info: (m: string, f?: unknown) => void logs.push([m, f]),
    },
    ...overrides,
  };
  return { boss: new FakeBoss(), deps, calls, logs };
}

describe('registerMailHandlers', () => {
  it('registers both mail queues and schedules them from the shared table', async () => {
    const { boss, deps } = setup();
    await registerMailHandlers(boss, deps as never);
    expect([...boss.handlers.keys()].sort()).toEqual(['email.digest', 'email.outbox']);
    expect(boss.schedules.map((s) => [s.name, s.cron, s.tz]).sort()).toEqual(
      MAIL_CRON_SCHEDULES.map((e) => [e.queue, e.cron, e.timezone]).sort(),
    );
  });

  it('queues at once notices, then sends, then prunes, when the outbox queue fires', async () => {
    const { boss, deps, calls, logs } = setup();
    await registerMailHandlers(boss, deps as never);
    await boss.send('email.outbox', {});
    await boss.drain('email.outbox');
    expect(calls).toEqual(['immediate', 'drain', 'prune']);
    expect(JSON.stringify(logs)).toContain('"sent":2');
  });

  it('keeps sending even when queuing the at once notices fails', async () => {
    const { boss, deps, calls } = setup({
      queueImmediate: async () => {
        throw new Error('prefs table busy');
      },
    });
    await registerMailHandlers(boss, deps as never);
    await boss.send('email.outbox', {});
    await boss.drain('email.outbox');
    expect(calls).toEqual(['drain', 'prune']);
  });

  it('builds the summaries when the digest queue fires', async () => {
    const { boss, deps, calls } = setup();
    await registerMailHandlers(boss, deps as never);
    await boss.send('email.digest', {});
    await boss.drain('email.digest');
    expect(calls).toEqual(['digests']);
  });
});
