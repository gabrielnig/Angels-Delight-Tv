// @vitest-environment jsdom
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@ad/ui';
import type { HomeRow } from '../../lib/data';
import { LazyHomeRows } from './LazyHomeRows';

vi.mock('../../app/actions', () => ({
  toggleListAction: vi.fn(),
  restoreContinueAction: vi.fn(),
  removeContinueAction: vi.fn(),
}));

let observed: Array<{ cb: IntersectionObserverCallback; options?: IntersectionObserverInit }> = [];
beforeEach(() => {
  observed = [];
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      constructor(
        public cb: IntersectionObserverCallback,
        public options?: IntersectionObserverInit,
      ) {
        observed.push({ cb, options });
      }
      observe() {}
      disconnect() {}
      unobserve() {}
    },
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
  localStorage.clear();
});

const row = (id: string): HomeRow => ({
  id,
  title: `Row ${id}`,
  seeAllHref: '/browse',
  items: [
    {
      kind: 'video',
      id: `v-${id}`,
      slug: `s-${id}`,
      title: `Video ${id}`,
      description: 'd',
      durationSeconds: 60,
      categorySlug: 'c',
      categoryName: 'C',
      hasCaptions: false,
      kidsSafe: true,
      publishedAt: '',
    },
  ],
});

const show = () => act(() => observed.at(-1)!.cb([{ isIntersecting: true } as never], {} as never));
const wrap = (ui: React.ReactElement) => render(<ToastProvider>{ui}</ToastProvider>);

describe('LazyHomeRows', () => {
  it('loads nothing until the end of the page is within one viewport', async () => {
    const load = vi.fn().mockResolvedValue({ rows: [row('a')], nextCursor: null });
    wrap(<LazyHomeRows initialCursor="c1" inList={[]} profileId="p1" load={load} />);
    expect(load).not.toHaveBeenCalled();
    expect(observed.at(-1)!.options?.rootMargin).toBe('100% 0px');
    show();
    await waitFor(() => expect(load).toHaveBeenCalledWith('c1'));
    expect(await screen.findByRole('heading', { name: 'Row a' })).toBeInTheDocument();
  });

  it('keeps loading page after page while the cursor continues', async () => {
    const load = vi
      .fn()
      .mockResolvedValueOnce({ rows: [row('a')], nextCursor: 'c2' })
      .mockResolvedValueOnce({ rows: [row('b')], nextCursor: null });
    wrap(<LazyHomeRows initialCursor="c1" inList={[]} profileId="p1" load={load} />);
    show();
    await screen.findByRole('heading', { name: 'Row a' });
    show();
    await screen.findByRole('heading', { name: 'Row b' });
    expect(load).toHaveBeenNthCalledWith(2, 'c2');
  });

  it('uses half a viewport of lead when Data saver is on', () => {
    localStorage.setItem('ad.datasaver.p1', 'on');
    wrap(<LazyHomeRows initialCursor="c1" inList={[]} profileId="p1" load={vi.fn()} />);
    expect(observed.at(-1)!.options?.rootMargin).toBe('50% 0px');
  });

  it('shows an inline error with Retry and keeps loaded rows', async () => {
    const load = vi
      .fn()
      .mockResolvedValueOnce({ rows: [row('a')], nextCursor: 'c2' })
      .mockRejectedValueOnce(new Error('down'))
      .mockResolvedValueOnce({ rows: [row('b')], nextCursor: null });
    wrap(<LazyHomeRows initialCursor="c1" inList={[]} profileId="p1" load={load} />);
    show();
    await screen.findByRole('heading', { name: 'Row a' });
    show();
    await userEvent.setup().click(await screen.findByRole('button', { name: /Try again|Retry/ }));
    expect(await screen.findByRole('heading', { name: 'Row b' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Row a' })).toBeInTheDocument();
  });

  it('retries a failed page by itself with backoff, then stops and leaves the button (M05-S08)', async () => {
    const load = vi
      .fn()
      .mockRejectedValueOnce(new Error('down'))
      .mockRejectedValueOnce(new Error('down'))
      .mockRejectedValueOnce(new Error('down'))
      .mockResolvedValue({ rows: [row('z')], nextCursor: null });
    wrap(
      <LazyHomeRows
        initialCursor="c1"
        inList={[]}
        profileId="p1"
        load={load}
        retryDelaysMs={[5, 5]}
      />,
    );
    show();
    await waitFor(() => expect(load).toHaveBeenCalledTimes(3));
    await new Promise((resolve) => setTimeout(resolve, 40));
    expect(load).toHaveBeenCalledTimes(3);
    expect(screen.getByRole('button', { name: /Try again|Retry/ })).toBeInTheDocument();
  });

  it('succeeds on an automatic retry without a tap', async () => {
    const load = vi
      .fn()
      .mockRejectedValueOnce(new Error('down'))
      .mockResolvedValue({ rows: [row('z')], nextCursor: null });
    wrap(
      <LazyHomeRows
        initialCursor="c1"
        inList={[]}
        profileId="p1"
        load={load}
        retryDelaysMs={[5]}
      />,
    );
    show();
    expect(await screen.findByRole('heading', { name: 'Row z' })).toBeInTheDocument();
  });

  it('retries at once when the network returns', async () => {
    const load = vi
      .fn()
      .mockRejectedValueOnce(new Error('down'))
      .mockResolvedValue({ rows: [row('z')], nextCursor: null });
    wrap(
      <LazyHomeRows initialCursor="c1" inList={[]} profileId="p1" load={load} retryDelaysMs={[]} />,
    );
    show();
    await screen.findByRole('button', { name: /Try again|Retry/ });
    await act(async () => void window.dispatchEvent(new Event('online')));
    expect(await screen.findByRole('heading', { name: 'Row z' })).toBeInTheDocument();
  });
});
