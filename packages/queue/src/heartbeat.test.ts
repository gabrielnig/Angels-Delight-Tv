import { describe, expect, it } from 'vitest';
import { WORKER_STALE_SECONDS, judgeHeartbeat, startHeartbeat } from './heartbeat';

describe('judgeHeartbeat (M24-S02 AC2)', () => {
  const now = new Date('2026-01-01T12:00:00Z');
  const ago = (s: number) => new Date(now.getTime() - s * 1000);

  it('is healthy within 5 minutes', () => {
    expect(WORKER_STALE_SECONDS).toBe(300);
    expect(judgeHeartbeat(ago(61), now)).toMatchObject({ ok: true, ageSeconds: 61 });
    expect(judgeHeartbeat(ago(300), now).ok).toBe(true);
  });
  it('is unhealthy past 5 minutes', () => {
    expect(judgeHeartbeat(ago(301), now)).toMatchObject({ ok: false, ageSeconds: 301 });
  });
  it('is unhealthy when the worker never reported', () => {
    expect(judgeHeartbeat(null, now)).toEqual({ ok: false, ageSeconds: null });
  });
});

describe('startHeartbeat', () => {
  it('beats at once and on every interval, and stops', async () => {
    const calls: number[] = [];
    let tick: (() => void) | undefined;
    const handle = startHeartbeat({
      beat: async () => void calls.push(calls.length),
      intervalMs: 60_000,
      schedule: (fn) => {
        tick = fn;
        return { stop: () => (tick = undefined) };
      },
    });
    await Promise.resolve();
    expect(calls).toHaveLength(1);
    tick!();
    await Promise.resolve();
    expect(calls).toHaveLength(2);
    handle.stop();
    expect(tick).toBeUndefined();
  });

  it('survives a failing write and reports it', async () => {
    const errors: unknown[] = [];
    let tick: (() => void) | undefined;
    startHeartbeat({
      beat: async () => {
        throw new Error('db down');
      },
      intervalMs: 1,
      onError: (e) => errors.push(e),
      schedule: (fn) => {
        tick = fn;
        return { stop: () => {} };
      },
    });
    await new Promise((r) => setTimeout(r, 5));
    tick!();
    await new Promise((r) => setTimeout(r, 5));
    expect(errors).toHaveLength(2);
  });
});
