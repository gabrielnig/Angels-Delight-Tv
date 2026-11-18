import { EXPORT_CRON_SCHEDULES } from '@ad/queue';
import { FakeBoss, MemoryMirror } from '@ad/queue/testing';
import { createLogger } from '@ad/shared';
import { describe, expect, it } from 'vitest';
import { registerExportHandlers } from './export-handlers';

const exportId = '0192f0a0-0000-7000-8000-000000000009';

function setup(overrides: Record<string, unknown> = {}) {
  const calls: Array<[string, unknown?]> = [];
  const deps = {
    generate: async (id: string, options: { finalAttempt: boolean }) => {
      calls.push(['generate', { id, ...options }]);
      return 'built' as const;
    },
    cleanup: async () => (calls.push(['cleanup']), 3),
    mirror: new MemoryMirror(),
    logger: createLogger({ write: () => undefined }),
    ...overrides,
  };
  return { boss: new FakeBoss(), deps, calls };
}

describe('registerExportHandlers', () => {
  it('registers the build and the cleanup, and schedules only the cleanup', async () => {
    const { boss, deps } = setup();
    await registerExportHandlers(boss, deps as never);
    expect([...boss.handlers.keys()].sort()).toEqual(['exports.cleanup', 'exports.generate']);
    expect(boss.schedules.map((s) => [s.name, s.cron, s.tz])).toEqual(
      EXPORT_CRON_SCHEDULES.map((e) => [e.queue, e.cron, e.timezone]),
    );
  });

  it('builds the export named in the job, and tells it when this is the last attempt', async () => {
    const { boss, deps, calls } = setup();
    await registerExportHandlers(boss, deps as never);
    await boss.send('exports.generate', { exportId });
    await boss.drain('exports.generate');
    expect(calls).toEqual([['generate', { id: exportId, finalAttempt: false }]]);
  });

  it('retries once when the build throws, and the second run is the last attempt', async () => {
    const seen: boolean[] = [];
    const { boss, deps } = setup({
      generate: async (_id: string, o: { finalAttempt: boolean }) => {
        seen.push(o.finalAttempt);
        if (!o.finalAttempt) throw new Error('storage down');
        return 'built';
      },
    });
    await registerExportHandlers(boss, deps as never);
    await boss.send('exports.generate', { exportId });
    await boss.drain('exports.generate');
    expect(seen).toEqual([false, true]);
  });

  it('runs the cleanup when its queue fires', async () => {
    const { boss, deps, calls } = setup();
    await registerExportHandlers(boss, deps as never);
    await boss.send('exports.cleanup', {});
    await boss.drain('exports.cleanup');
    expect(calls).toEqual([['cleanup']]);
  });
});
