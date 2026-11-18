import { describe, expect, it, vi } from 'vitest';
import { CatalogCache } from './cache';

const clock = () => {
  let at = 1_000_000;
  return { now: () => at, tick: (ms: number) => (at += ms) };
};

describe('CatalogCache (M04-S05)', () => {
  it('serves a repeat read from memory for 60 seconds, then reloads', async () => {
    const c = clock();
    const cache = new CatalogCache({ now: c.now });
    const load = vi.fn(async () => ({ n: load.mock.calls.length }));
    expect(await cache.remember('k', load)).toEqual({ n: 1 });
    c.tick(59_000);
    expect(await cache.remember('k', load)).toEqual({ n: 1 });
    c.tick(2_000);
    expect(await cache.remember('k', load)).toEqual({ n: 2 });
  });

  it('keeps keys apart', async () => {
    const cache = new CatalogCache();
    expect(await cache.remember('a', async () => 'A')).toBe('A');
    expect(await cache.remember('b', async () => 'B')).toBe('B');
  });

  it('is emptied by invalidate, so a publish or edit shows at once', async () => {
    const cache = new CatalogCache();
    let value = 'old';
    expect(await cache.remember('k', async () => value)).toBe('old');
    value = 'new';
    cache.invalidate();
    expect(await cache.remember('k', async () => value)).toBe('new');
  });

  it('does not store a read that began before an invalidation', async () => {
    const cache = new CatalogCache();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    const slow = cache.remember('k', async () => {
      await gate;
      return 'stale';
    });
    cache.invalidate();
    release();
    expect(await slow).toBe('stale');
    expect(await cache.remember('k', async () => 'fresh')).toBe('fresh');
  });

  it('never serves old data when the database fails: the error goes to the caller and is not stored', async () => {
    const c = clock();
    const cache = new CatalogCache({ now: c.now });
    await cache.remember('k', async () => 'ok');
    c.tick(61_000);
    await expect(
      cache.remember('k', async () => {
        throw new Error('db down');
      }),
    ).rejects.toThrow('db down');
    expect(await cache.remember('k', async () => 'back')).toBe('back');
  });

  it('shares one load between simultaneous readers', async () => {
    const cache = new CatalogCache();
    const load = vi.fn(async () => 'x');
    await Promise.all([
      cache.remember('k', load),
      cache.remember('k', load),
      cache.remember('k', load),
    ]);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('keeps at most the configured number of entries', async () => {
    const cache = new CatalogCache({ maxEntries: 2 });
    for (const k of ['a', 'b', 'c']) await cache.remember(k, async () => k);
    expect(cache.size).toBe(2);
  });
});
