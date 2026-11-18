import { describe, expect, it, vi } from 'vitest';
import { listWrite, toggleWithQueue } from './list-write';

describe('listWrite', () => {
  it('builds the My List request for a video, newest write per title', () => {
    expect(listWrite('p1', 'video:abc', true)).toEqual({
      profileId: 'p1',
      key: 'list:video:abc',
      url: '/api/my-list',
      method: 'POST',
      body: { profileId: 'p1', target: { kind: 'video', id: 'abc' } },
    });
  });
  it('uses DELETE with a body for a removal and handles series', () => {
    expect(listWrite('p1', 'series:s9', false)).toMatchObject({
      method: 'DELETE',
      body: { profileId: 'p1', target: { kind: 'series', id: 's9' } },
    });
  });
});

describe('toggleWithQueue', () => {
  const base = { itemKey: 'video:abc', add: true, profileId: 'p1' };

  it('sends straight away when online', async () => {
    const toggle = vi.fn().mockResolvedValue(undefined);
    const queue = { add: vi.fn() };
    expect(await toggleWithQueue({ ...base, toggle, online: true, queue })).toBe('sent');
    expect(queue.add).not.toHaveBeenCalled();
  });

  it('queues without calling the server when offline', async () => {
    const toggle = vi.fn();
    const queue = { add: vi.fn() };
    expect(await toggleWithQueue({ ...base, toggle, online: false, queue })).toBe('queued');
    expect(toggle).not.toHaveBeenCalled();
    expect(queue.add).toHaveBeenCalledWith(expect.objectContaining({ key: 'list:video:abc' }));
  });

  it('queues when the request fails on the network', async () => {
    const toggle = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    const queue = { add: vi.fn() };
    expect(await toggleWithQueue({ ...base, toggle, online: true, queue })).toBe('queued');
  });

  it('rethrows a server refusal so the caller rolls back', async () => {
    const toggle = vi.fn().mockRejectedValue(new Error('My List is full'));
    const queue = { add: vi.fn() };
    await expect(toggleWithQueue({ ...base, toggle, online: true, queue })).rejects.toThrow(
      'My List is full',
    );
    expect(queue.add).not.toHaveBeenCalled();
  });

  it('rethrows when there is no profile to queue for', async () => {
    const toggle = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(
      toggleWithQueue({ ...base, profileId: null, toggle, online: true, queue: { add: vi.fn() } }),
    ).rejects.toThrow();
  });
});
