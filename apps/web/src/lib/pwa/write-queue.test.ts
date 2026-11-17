import { describe, expect, it, vi } from 'vitest';
import { createWriteQueue, MAX_QUEUE, type QueuedWrite } from './write-queue';

const memory = () => {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
  };
};
const w = (profile: string, key: string, body: unknown = {}): QueuedWrite => ({
  profileId: profile,
  key,
  url: '/api/x',
  method: 'PUT',
  body,
});

describe('write queue (M25-S05)', () => {
  it('keeps only the latest write per item', () => {
    const q = createWriteQueue(memory());
    q.add(w('p', 'progress:v1', { s: 10 }));
    q.add(w('p', 'progress:v1', { s: 20 }));
    q.add(w('p', 'list:v2'));
    expect(q.pending('p').map((x) => x.body)).toEqual([{ s: 20 }, {}]);
  });
  it('is keyed by profile', () => {
    const q = createWriteQueue(memory());
    q.add(w('a', 'k'));
    q.add(w('b', 'k'));
    expect(q.pending('a')).toHaveLength(1);
    expect(q.pending('b')).toHaveLength(1);
  });
  it('caps at 100 items and drops the oldest', () => {
    const q = createWriteQueue(memory());
    for (let i = 0; i < MAX_QUEUE + 5; i += 1) q.add(w('p', `k${i}`));
    const items = q.pending('p');
    expect(items).toHaveLength(MAX_QUEUE);
    expect(items[0]!.key).toBe('k5');
  });
  it('sends in order and removes what succeeded', async () => {
    const q = createWriteQueue(memory());
    q.add(w('p', 'a'));
    q.add(w('p', 'b'));
    const order: string[] = [];
    const result = await q.flush('p', async (item) => {
      order.push(item.key);
      return 200;
    });
    expect(order).toEqual(['a', 'b']);
    expect(result).toEqual({ sent: 2, dropped: 0, stoppedOffline: false });
    expect(q.pending('p')).toHaveLength(0);
  });
  it('drops a write rejected with 401 or 403 and reports it', async () => {
    const q = createWriteQueue(memory());
    q.add(w('p', 'a'));
    q.add(w('p', 'b'));
    const result = await q.flush('p', async (item) => (item.key === 'a' ? 403 : 200));
    expect(result).toMatchObject({ sent: 1, dropped: 1 });
  });
  it('stops and keeps the rest when the network fails', async () => {
    const q = createWriteQueue(memory());
    q.add(w('p', 'a'));
    q.add(w('p', 'b'));
    const send = vi.fn(async () => {
      throw new TypeError('offline');
    });
    const result = await q.flush('p', send);
    expect(result.stoppedOffline).toBe(true);
    expect(send).toHaveBeenCalledTimes(1);
    expect(q.pending('p')).toHaveLength(2);
  });
  it('persists through the store and survives corrupt data', () => {
    const store = memory();
    createWriteQueue(store).add(w('p', 'a'));
    expect(createWriteQueue(store).pending('p')).toHaveLength(1);
    store.setItem('ad.writequeue.v1', '{nope');
    expect(createWriteQueue(store).pending('p')).toEqual([]);
  });
});
