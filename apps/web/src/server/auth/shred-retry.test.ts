import { afterEach, describe, expect, it, vi } from 'vitest';
import { runDeletionJobs, startShredRetry } from './shred-retry';

afterEach(() => vi.useRealTimers());

describe('startShredRetry', () => {
  it('runs once at start and then on every interval', async () => {
    vi.useFakeTimers();
    const run = vi.fn().mockResolvedValue(0);
    const stop = startShredRetry({ run, intervalMs: 1000, logger: { error: vi.fn() } });
    await vi.advanceTimersByTimeAsync(0);
    expect(run).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(2500);
    expect(run).toHaveBeenCalledTimes(3);
    stop();
    await vi.advanceTimersByTimeAsync(5000);
    expect(run).toHaveBeenCalledTimes(3);
  });

  it('keeps retrying after a failure and reports it', async () => {
    vi.useFakeTimers();
    const error = vi.fn();
    const run = vi.fn().mockRejectedValueOnce(new Error('keys db down')).mockResolvedValue(2);
    startShredRetry({ run, intervalMs: 1000, logger: { error } });
    await vi.advanceTimersByTimeAsync(1100);
    expect(error).toHaveBeenCalledTimes(1);
    expect(run).toHaveBeenCalledTimes(2);
  });

  it('never overlaps two runs', async () => {
    vi.useFakeTimers();
    let release: () => void = () => undefined;
    const run = vi.fn(() => new Promise<number>((resolve) => (release = () => resolve(0))));
    startShredRetry({ run, intervalMs: 1000, logger: { error: vi.fn() } });
    await vi.advanceTimersByTimeAsync(3500);
    expect(run).toHaveBeenCalledTimes(1);
    release();
    await vi.advanceTimersByTimeAsync(1000);
    expect(run).toHaveBeenCalledTimes(2);
  });
});

describe('runDeletionJobs', () => {
  it('purges accounts past the grace period first, then finishes pending key destruction', async () => {
    const order: string[] = [];
    const total = await runDeletionJobs({
      purgeDueDeletions: async () => {
        order.push('purge');
        return 2;
      },
      destroyPendingKeys: async () => {
        order.push('shred');
        return 3;
      },
    });
    expect(order).toEqual(['purge', 'shred']);
    expect(total).toBe(5);
  });

  it('still destroys pending keys when the purge fails, then reports the failure', async () => {
    const destroyPendingKeys = vi.fn(async () => 1);
    await expect(
      runDeletionJobs({
        purgeDueDeletions: async () => {
          throw new Error('db down');
        },
        destroyPendingKeys,
      }),
    ).rejects.toThrow('db down');
    expect(destroyPendingKeys).toHaveBeenCalled();
  });
});
