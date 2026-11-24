// @vitest-environment jsdom
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const nav = vi.hoisted(() => ({ pathname: '/browse' }));
vi.mock('next/navigation', () => ({
  usePathname: () => nav.pathname,
  useRouter: () => ({ push: vi.fn() }),
}));
const saver = vi.hoisted(() => ({ on: false }));
vi.mock('../../lib/lowdata/useDataSaver', () => ({
  useDataSaver: () => ({ on: saver.on, announce: false, setOn: vi.fn(), dismissAnnouncement: vi.fn() }),
}));

import { ViewerBell } from './ViewerBell';

const notice = (id: string, over: Partial<Record<string, unknown>> = {}) => ({
  id,
  kind: 'new_episode',
  title: `3 new episodes of Everyday Science ${id}`,
  body: '',
  href: '/series/everyday-science',
  itemCount: 3,
  createdAt: new Date().toISOString(),
  read: false,
  ...over,
});

function mockFetch(handler: (url: string, init?: RequestInit) => unknown) {
  const fn = vi.fn(async (url: string, init?: RequestInit) => {
    const result = handler(String(url), init);
    if (result instanceof Response) return result;
    return new Response(JSON.stringify(result), { status: 200 });
  });
  vi.stubGlobal('fetch', fn);
  return fn;
}

function wide(on: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: on && query.includes('min-width'),
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
}

describe('ViewerBell (M44-S11)', () => {
  beforeEach(() => {
    saver.on = false;
    nav.pathname = '/browse';
    wide(true);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('shows the unread count as a number with a spoken label', async () => {
    mockFetch(() => ({ count: 3 }));
    render(<ViewerBell profileId="p1" />);
    const bell = await screen.findByRole('button', { name: '3 unread notifications' });
    expect(bell).toHaveTextContent('3');
  });

  it('caps the number at 9+ and speaks the real count, and shows no badge at zero', async () => {
    mockFetch(() => ({ count: 12 }));
    const { unmount } = render(<ViewerBell profileId="p1" />);
    const bell = await screen.findByRole('button', { name: '12 unread notifications' });
    expect(bell).toHaveTextContent('9+');
    unmount();
    mockFetch(() => ({ count: 0 }));
    render(<ViewerBell profileId="p1" />);
    const none = await screen.findByRole('button', { name: 'No unread notifications' });
    expect(none).not.toHaveTextContent(/\d/);
  });

  it('refreshes the count on route change and every five minutes while visible', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const fetcher = mockFetch(() => ({ count: 1 }));
    const { rerender } = render(<ViewerBell profileId="p1" />);
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
    nav.pathname = '/my-list';
    rerender(<ViewerBell profileId="p1" />);
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5 * 60 * 1000 + 100);
    });
    expect(fetcher.mock.calls.length).toBeGreaterThanOrEqual(3);
  });

  it('does not fetch the count under Data saver, only when the bell opens', async () => {
    saver.on = true;
    const fetcher = mockFetch((url) => (url.includes('/count') ? { count: 2 } : { items: [notice('a')], unread: 2, nextCursor: null }));
    render(<ViewerBell profileId="p1" />);
    await new Promise((r) => setTimeout(r, 20));
    expect(fetcher).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Notifications' }));
    await screen.findByText(/3 new episodes of Everyday Science a/);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Data saver is on. The count updates when you open the bell.')).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: '2 unread notifications' })).toBeInTheDocument();
  });

  it('opens a popover with the latest notices, Mark all as read and See all, and closes on Escape with focus back on the bell', async () => {
    const fetcher = mockFetch((url, init) => {
      if (url.includes('/count')) return { count: 2 };
      if (init?.method === 'POST') return { updated: 2 };
      return { items: [notice('a'), notice('b', { read: true })], unread: 2, nextCursor: null };
    });
    render(<ViewerBell profileId="p1" />);
    const bell = await screen.findByRole('button', { name: '2 unread notifications' });
    await userEvent.click(bell);
    const dialog = await screen.findByRole('dialog', { name: 'Notifications' });
    expect(dialog).toBeInTheDocument();
    expect(await screen.findByText('Unread.', { exact: false })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'See all' })).toHaveAttribute('href', '/notifications');
    await userEvent.click(screen.getByRole('button', { name: 'Mark all as read' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'No unread notifications' })).toBeInTheDocument());
    const post = fetcher.mock.calls.find(([, init]) => init?.method === 'POST');
    expect(JSON.parse(String(post?.[1]?.body))).toEqual({ profileId: 'p1', ids: 'all' });
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.getByRole('button', { name: 'No unread notifications' })).toHaveFocus();
  });

  it('marks a notice read when it is opened and keeps its link', async () => {
    const fetcher = mockFetch((url, init) => {
      if (url.includes('/count')) return { count: 1 };
      if (init?.method === 'POST') return { updated: 1 };
      return { items: [notice('a')], unread: 1, nextCursor: null };
    });
    render(<ViewerBell profileId="p1" />);
    await userEvent.click(await screen.findByRole('button', { name: '1 unread notification' }));
    const link = await screen.findByRole('link', { name: /3 new episodes of Everyday Science a/ });
    expect(link).toHaveAttribute('href', '/series/everyday-science');
    link.addEventListener('click', (e) => e.preventDefault());
    await userEvent.click(link);
    const post = fetcher.mock.calls.find(([, init]) => init?.method === 'POST');
    expect(JSON.parse(String(post?.[1]?.body))).toEqual({ profileId: 'p1', ids: ['a'] });
  });

  it('shows the empty and error states, and Try again reloads', async () => {
    let fail = true;
    mockFetch((url) => {
      if (url.includes('/count')) return { count: 0 };
      if (fail) return new Response('{}', { status: 500 });
      return { items: [], unread: 0, nextCursor: null };
    });
    render(<ViewerBell profileId="p1" />);
    await userEvent.click(await screen.findByRole('button', { name: 'No unread notifications' }));
    expect(await screen.findByText('We could not load notifications. Try again.')).toBeInTheDocument();
    fail = false;
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Nothing new')).toBeInTheDocument();
    expect(screen.getByText('We will tell you when something arrives.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mark all as read' })).toBeDisabled();
  });

  it('on a narrow screen the bell is a link to the notifications page, not a popover', async () => {
    wide(false);
    mockFetch(() => ({ count: 3 }));
    render(<ViewerBell profileId="p1" />);
    const link = await screen.findByRole('link', { name: '3 unread notifications' });
    expect(link).toHaveAttribute('href', '/notifications');
    await userEvent.click(link);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('keeps the bell quiet when the count cannot be loaded', async () => {
    mockFetch(() => new Response('{}', { status: 500 }));
    render(<ViewerBell profileId="p1" />);
    const bell = await screen.findByRole('button', { name: 'Notifications' });
    expect(bell).not.toHaveTextContent(/\d/);
  });
});
