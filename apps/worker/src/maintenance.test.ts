import { AUDIT_RETENTION_SCHEDULE } from '@ad/audit';
import { RETENTION_SCHEDULE, ROLLUP_SCHEDULE } from '@ad/analytics';
import { MAINTENANCE_CRON_SCHEDULES } from '@ad/queue';
import { FakeBoss, MemoryMirror } from '@ad/queue/testing';
import { createLogger } from '@ad/shared';
import { describe, expect, it } from 'vitest';
import { registerMaintenanceHandlers } from './maintenance';

function setup(overrides: Record<string, unknown> = {}) {
  const calls: string[] = [];
  const deps = {
    rollup: async () => void calls.push('rollup'),
    pruneViewEvents: async () => void calls.push('prune-events'),
    pruneAudit: async () => void calls.push('prune-audit'),
    mirror: new MemoryMirror(),
    logger: createLogger({ write: () => undefined }),
    ...overrides,
  };
  return { boss: new FakeBoss(), deps, calls };
}

describe('registerMaintenanceHandlers', () => {
  it('registers the three jobs and schedules each in Lagos time', async () => {
    const { boss, deps } = setup();
    await registerMaintenanceHandlers(boss, deps as never);
    expect([...boss.handlers.keys()].sort()).toEqual([
      'analytics.prune',
      'analytics.rollup',
      'audit.prune',
    ]);
    expect(boss.schedules.map((s) => s.name).sort()).toEqual([
      'analytics.prune',
      'analytics.rollup',
      'audit.prune',
    ]);
    expect(boss.schedules.every((s) => s.tz === 'Africa/Lagos')).toBe(true);
  });

  it('uses the schedules the analytics and audit packages publish', () => {
    const cron = (queue: string) => MAINTENANCE_CRON_SCHEDULES.find((e) => e.queue === queue);
    expect(cron('analytics.rollup')).toMatchObject({
      cron: ROLLUP_SCHEDULE.cron,
      timezone: ROLLUP_SCHEDULE.timeZone,
    });
    expect(cron('analytics.prune')).toMatchObject({
      cron: RETENTION_SCHEDULE.cron,
      timezone: RETENTION_SCHEDULE.timeZone,
    });
    expect(cron('audit.prune')).toMatchObject({
      cron: AUDIT_RETENTION_SCHEDULE.cron,
      timezone: AUDIT_RETENTION_SCHEDULE.timeZone,
    });
  });

  it('runs each job body when its queue fires', async () => {
    const { boss, deps, calls } = setup();
    await registerMaintenanceHandlers(boss, deps as never);
    for (const queue of ['analytics.rollup', 'analytics.prune', 'audit.prune']) {
      await boss.send(queue, {});
      await boss.drain(queue);
    }
    expect(calls).toEqual(['rollup', 'prune-events', 'prune-audit']);
  });

  it('leaves the prunes out and says so when no maintenance connection is configured', async () => {
    const warnings: string[] = [];
    const { boss, deps } = setup({
      pruneViewEvents: undefined,
      pruneAudit: undefined,
      logger: {
        ...createLogger({ write: () => undefined }),
        warn: (m: string) => warnings.push(m),
      },
    });
    await registerMaintenanceHandlers(boss, deps as never);
    expect([...boss.handlers.keys()]).toEqual(['analytics.rollup']);
    expect(boss.schedules.map((s) => s.name)).toEqual(['analytics.rollup']);
    expect(warnings.join(' ')).toContain('DATABASE_URL_MAINTENANCE');
  });
});
