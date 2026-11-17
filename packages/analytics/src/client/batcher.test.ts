import { describe, expect, it, vi } from 'vitest';
import { createAnalyticsClient, type ClientEnv } from './batcher';

const playId = '3f2b8c1e-5d4a-4e7b-9a1c-0d2e4f6a8b10';
const videoId = '0b7f6d52-1c3e-4a58-8f19-2a4c6e8d0b31';

function setup(overrides: Partial<ClientEnv> = {}) {
  const beacons: Array<{ url: string; body: string }> = [];
  const fetches: Array<{ url: string; body: string; keepalive?: boolean }> = [];
  const listeners = new Map<string, () => void>();
  const timers: Array<() => void> = [];
  const env: ClientEnv = {
    sendBeacon: vi.fn((url: string, data: Blob | string) => {
      beacons.push({ url, body: String(data) });
      return true;
    }),
    fetch: vi.fn(async (url: string, init: { body: string; keepalive?: boolean }) => {
      fetches.push({ url, body: init.body, keepalive: init.keepalive });
      return { ok: true };
    }),
    onPageHide: (handler) => void listeners.set('hide', handler),
    setInterval: (fn) => {
      timers.push(fn);
      return timers.length;
    },
    clearInterval: vi.fn(),
    ...overrides,
  };
  return { env, beacons, fetches, listeners, timers };
}

const progress = (watchedMs: number) =>
  ({ kind: 'progress', playId, videoId, watchedMs, positionMs: watchedMs }) as const;

describe('createAnalyticsClient', () => {
  it('sends a batch when it reaches the batch size', async () => {
    const { env, fetches } = setup();
    const client = createAnalyticsClient({ endpoint: '/api/analytics', maxBatch: 2 }, env);
    client.track({ kind: 'error', code: 'a' });
    expect(fetches).toHaveLength(0);
    client.track({ kind: 'error', code: 'b' });
    await client.idle();
    expect(fetches).toHaveLength(1);
    const body = JSON.parse(fetches[0]!.body);
    expect(body.v).toBe(1);
    expect(body.events).toHaveLength(2);
  });

  it('flushes on the interval timer', async () => {
    const { env, fetches, timers } = setup();
    const client = createAnalyticsClient({ endpoint: '/api/analytics' }, env);
    client.track({ kind: 'error', code: 'a' });
    timers[0]!();
    await client.idle();
    expect(fetches).toHaveLength(1);
  });

  it('uses sendBeacon when the page is hiding and falls back to keepalive fetch', async () => {
    const { env, beacons, fetches, listeners } = setup();
    const client = createAnalyticsClient({ endpoint: '/api/analytics' }, env);
    client.track({ kind: 'error', code: 'a' });
    listeners.get('hide')!();
    expect(beacons).toHaveLength(1);
    expect(fetches).toHaveLength(0);

    const second = setup({ sendBeacon: vi.fn(() => false) });
    const c2 = createAnalyticsClient({ endpoint: '/api/analytics' }, second.env);
    c2.track({ kind: 'error', code: 'a' });
    second.listeners.get('hide')!();
    await c2.idle();
    expect(second.fetches).toHaveLength(1);
    expect(second.fetches[0]!.keepalive).toBe(true);
  });

  it('keeps only the latest progress event per play', async () => {
    const { env, fetches } = setup();
    const client = createAnalyticsClient({ endpoint: '/api/analytics' }, env);
    client.track(progress(10_000));
    client.track(progress(20_000));
    await client.flush();
    const events = JSON.parse(fetches[0]!.body).events;
    expect(events).toHaveLength(1);
    expect(events[0].watchedMs).toBe(20_000);
  });

  it('never throws and never rejects when the network fails', async () => {
    const { env } = setup({
      fetch: vi.fn(async () => {
        throw new Error('offline');
      }),
    });
    const client = createAnalyticsClient({ endpoint: '/api/analytics' }, env);
    client.track({ kind: 'error', code: 'a' });
    await expect(client.flush()).resolves.toBeUndefined();
  });

  it('caps the queue so a long offline session cannot grow memory', async () => {
    const { env, fetches } = setup();
    const client = createAnalyticsClient(
      { endpoint: '/api/analytics', maxBatch: 1000, maxQueue: 5 },
      env,
    );
    for (let i = 0; i < 20; i += 1) client.track({ kind: 'error', code: `e${i}` });
    await client.flush();
    expect(JSON.parse(fetches[0]!.body).events.length).toBeLessThanOrEqual(5);
  });

  it('attaches device class and save data once per batch and marks previews', async () => {
    const { env, fetches } = setup();
    const client = createAnalyticsClient(
      { endpoint: '/api/analytics', deviceClass: 'phone', saveData: true, preview: true },
      env,
    );
    client.track({ kind: 'error', code: 'a' });
    await client.flush();
    const body = JSON.parse(fetches[0]!.body);
    expect(body).toMatchObject({ deviceClass: 'phone', saveData: true, preview: true });
  });

  it('sends nothing when the queue is empty and stops timers on dispose', async () => {
    const { env, fetches } = setup();
    const client = createAnalyticsClient({ endpoint: '/api/analytics' }, env);
    await client.flush();
    expect(fetches).toHaveLength(0);
    client.dispose();
    expect(env.clearInterval).toHaveBeenCalled();
  });
});
