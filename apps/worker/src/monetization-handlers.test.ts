import { MONETIZATION_CRON_SCHEDULES } from '@ad/queue';
import { FakeBoss, MemoryMirror } from '@ad/queue/testing';
import { createLogger } from '@ad/shared';
import { describe, expect, it, vi } from 'vitest';
import { registerMonetizationHandlers } from './monetization-handlers';

const logger = createLogger({ write: () => undefined });
const reconcileResult = { checked: 0, succeeded: 0, failed: 0, abandoned: 0, requeued: 0, errors: 0 };

describe('registerMonetizationHandlers', () => {
  it('registers all four jobs and schedules the crons when payments are configured', async () => {
    const boss = new FakeBoss();
    const deps = {
      processEvent: vi.fn(async () => 'succeeded'),
      reconcile: vi.fn(async () => reconcileResult),
      pruneEvents: vi.fn(async () => 2),
      pruneReach: vi.fn(async () => 5),
      mirror: new MemoryMirror(),
      logger,
    };
    await registerMonetizationHandlers(boss, deps);
    expect([...boss.handlers.keys()].sort()).toEqual(['donations.process_event', 'donations.prune_events', 'donations.reconcile', 'sponsors.reach_prune']);
    expect(boss.schedules.map((s) => [s.name, s.cron, s.tz])).toEqual(MONETIZATION_CRON_SCHEDULES.map((e) => [e.queue, e.cron, e.timezone]));
    await boss.send('sponsors.reach_prune', {});
    await boss.drain('sponsors.reach_prune');
    await boss.send('donations.reconcile', {});
    await boss.drain('donations.reconcile');
    await boss.send('donations.prune_events', {});
    await boss.drain('donations.prune_events');
    expect([deps.pruneReach.mock.calls.length, deps.reconcile.mock.calls.length, deps.pruneEvents.mock.calls.length]).toEqual([1, 1, 1]);
  });

  it('passes the event id and the attempt to the processor', async () => {
    const boss = new FakeBoss();
    const processEvent = vi.fn(async () => 'succeeded');
    await registerMonetizationHandlers(boss, {
      processEvent,
      reconcile: async () => reconcileResult,
      pruneEvents: async () => 0,
      pruneReach: async () => 0,
      mirror: new MemoryMirror(),
      logger,
    });
    await boss.send('donations.process_event', { eventId: 7 });
    await boss.drain('donations.process_event');
    expect(processEvent).toHaveBeenCalledWith(7, expect.objectContaining({ attempt: 1 }));
  });

  it('keeps the reach prune but registers no donation job and no donation cron when payments are not configured', async () => {
    const boss = new FakeBoss();
    await registerMonetizationHandlers(boss, { pruneReach: async () => 0, mirror: new MemoryMirror(), logger });
    expect([...boss.handlers.keys()]).toEqual(['sponsors.reach_prune']);
    expect(boss.schedules.map((s) => s.name)).toEqual(['sponsors.reach_prune']);
  });
});
