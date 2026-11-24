// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

const saver = vi.hoisted(() => ({ on: false }));
vi.mock('../../lib/lowdata/useDataSaver', () => ({
  useDataSaver: () => ({ on: saver.on, announce: false, setOn: vi.fn(), dismissAnnouncement: vi.fn() }),
}));

import { NoticesKidsState, NoticesView } from './NoticesView';

const item = (id: string, read = false) => ({
  id,
  kind: 'new_video' as const,
  title: `5 new videos ${id}`,
  body: 'One, Two, Three',
  href: '/browse',
  itemCount: 5,
  createdAt: '2026-11-24T07:10:00Z',
  read,
});

function mockFetch(handler: (url: string, init?: RequestInit) => unknown) {
  const fn = vi.fn(async (url: string, init?: RequestInit) => {
    const result = handler(String(url), init);
    return result instanceof Response ? result : new Response(JSON.stringify(result), { status: 200 });
  });
  vi.stubGlobal('fetch', fn);
  return fn;
}

describe('notifications page (M44-S11)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    saver.on = false;
  });

  it('lists notices, marks all read, and shows the empty state', async () => {
    const fetcher = mockFetch((_url, init) =>
      init?.method === 'POST' ? { updated: 2 } : { items: [item('a'), item('b', true)], unread: 1, nextCursor: null },
    );
    render(<NoticesView profileId="p1" />);
    expect(await screen.findByText(/5 new videos a/)).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Notifications' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Mark all as read' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Mark all as read' })).toBeDisabled());
    expect(JSON.parse(String(fetcher.mock.calls[1]?.[1]?.body))).toEqual({ profileId: 'p1', ids: 'all' });
  });

  it('shows Nothing new when there are no notices', async () => {
    mockFetch(() => ({ items: [], unread: 0, nextCursor: null }));
    render(<NoticesView profileId="p1" />);
    expect(await screen.findByText('Nothing new')).toBeInTheDocument();
  });

  it('offers Show more when there is another page and appends it', async () => {
    let call = 0;
    mockFetch(() =>
      ++call === 1
        ? { items: [item('a')], unread: 1, nextCursor: 'c1' }
        : { items: [item('z', true)], unread: 1, nextCursor: null },
    );
    render(<NoticesView profileId="p1" />);
    await userEvent.click(await screen.findByRole('button', { name: 'Show more' }));
    expect(await screen.findByText(/5 new videos z/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Show more' })).toBeNull();
  });

  it('shows the error state with Try again', async () => {
    mockFetch(() => new Response('{}', { status: 500 }));
    render(<NoticesView profileId="p1" />);
    expect(await screen.findByText('We could not load notifications. Try again.')).toBeInTheDocument();
  });

  it('shows the Data saver note', async () => {
    saver.on = true;
    mockFetch(() => ({ items: [], unread: 0, nextCursor: null }));
    render(<NoticesView profileId="p1" />);
    expect(await screen.findByText('Data saver is on. The count updates when you open the bell.')).toBeInTheDocument();
  });

  it('the kids state explains and offers a way out', () => {
    render(<NoticesKidsState />);
    expect(screen.getByText('This is not available on this profile')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Switch profile' })).toHaveAttribute('href', '/profiles?switch=1');
  });
});
