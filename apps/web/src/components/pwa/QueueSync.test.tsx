// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createWriteQueue } from '../../lib/pwa/write-queue';
import { listWrite } from '../../lib/pwa/list-write';
import { QueueSync } from './QueueSync';

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('QueueSync', () => {
  it('sends queued writes for the profile when the page opens online', async () => {
    createWriteQueue(localStorage).add(listWrite('p1', 'video:a', true));
    const fetchMock = vi.fn().mockResolvedValue({ status: 201 });
    vi.stubGlobal('fetch', fetchMock);
    render(<QueueSync profileId="p1" />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('/api/my-list');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({ profileId: 'p1', target: { kind: 'video', id: 'a' } });
    await waitFor(() => expect(createWriteQueue(localStorage).pending('p1')).toHaveLength(0));
  });

  it('sends a removal with its body', async () => {
    createWriteQueue(localStorage).add(listWrite('p1', 'video:a', false));
    const fetchMock = vi.fn().mockResolvedValue({ status: 200 });
    vi.stubGlobal('fetch', fetchMock);
    render(<QueueSync profileId="p1" />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    expect(fetchMock.mock.calls[0]![1].method).toBe('DELETE');
    expect(fetchMock.mock.calls[0]![1].body).toContain('"target"');
  });

  it('keeps the queue and retries when the network comes back', async () => {
    createWriteQueue(localStorage).add(listWrite('p1', 'video:a', true));
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('offline'))
      .mockResolvedValue({ status: 201 });
    vi.stubGlobal('fetch', fetchMock);
    render(<QueueSync profileId="p1" />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    expect(createWriteQueue(localStorage).pending('p1')).toHaveLength(1);
    window.dispatchEvent(new Event('online'));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  });

  it('never sends another profile writes', async () => {
    createWriteQueue(localStorage).add(listWrite('p2', 'video:a', true));
    const fetchMock = vi.fn().mockResolvedValue({ status: 201 });
    vi.stubGlobal('fetch', fetchMock);
    render(<QueueSync profileId="p1" />);
    await new Promise((r) => setTimeout(r, 20));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('tells the person once when a saved change could not be kept (M25-S05)', async () => {
    createWriteQueue(localStorage).add(listWrite('p1', 'video:a', true));
    createWriteQueue(localStorage).add(listWrite('p1', 'video:b', true));
    const fetchMock = vi.fn().mockResolvedValue({ status: 403 });
    vi.stubGlobal('fetch', fetchMock);
    render(<QueueSync profileId="p1" />);
    expect(
      await screen.findByText('Some changes you made offline could not be saved.'),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('status')).toHaveLength(1);
  });

  it('stays quiet when everything was sent', async () => {
    createWriteQueue(localStorage).add(listWrite('p1', 'video:a', true));
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ status: 201 }));
    render(<QueueSync profileId="p1" />);
    await waitFor(() => expect(createWriteQueue(localStorage).pending('p1')).toHaveLength(0));
    expect(screen.queryByRole('status')).toBeNull();
  });
});
