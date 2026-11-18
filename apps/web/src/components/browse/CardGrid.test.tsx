// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@ad/ui';
import type { CatalogItem, Page } from '../../lib/data';
import { CardGrid } from './CardGrid';

const video = (n: number): CatalogItem => ({
  kind: 'video',
  id: `v${n}`,
  slug: `video-${n}`,
  title: `Video ${n}`,
  description: 'd',
  durationSeconds: 240,
  categorySlug: 'science',
  categoryName: 'Science',
  hasCaptions: true,
  kidsSafe: true,
  publishedAt: '2026-11-01T00:00:00.000Z',
});

const wrap = (ui: React.ReactElement) => render(<ToastProvider>{ui}</ToastProvider>);

describe('CardGrid', () => {
  it('lists cards in a list with a live count', () => {
    wrap(
      <CardGrid
        initialItems={[video(1), video(2)]}
        total={2}
        nextCursor={null}
        inList={[]}
        loadMore={vi.fn()}
        countLabel="videos"
      />,
    );
    expect(screen.getByRole('list')).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(screen.getByText('2 videos')).toHaveAttribute('aria-live', 'polite');
  });

  it('says 1 video in the singular', () => {
    wrap(
      <CardGrid
        initialItems={[video(1)]}
        total={1}
        nextCursor={null}
        inList={[]}
        loadMore={vi.fn()}
        countLabel="videos"
      />,
    );
    expect(screen.getByText('1 video')).toBeInTheDocument();
  });

  it('hides Show more when there is no next page', () => {
    wrap(
      <CardGrid
        initialItems={[video(1)]}
        total={1}
        nextCursor={null}
        inList={[]}
        loadMore={vi.fn()}
        countLabel="videos"
      />,
    );
    expect(screen.queryByRole('button', { name: 'Show more' })).toBeNull();
  });

  it('appends the next page on Show more and keeps going until done', async () => {
    const loadMore = vi
      .fn<(cursor: string) => Promise<Page<CatalogItem>>>()
      .mockResolvedValue({ items: [video(3), video(4)], total: 4, nextCursor: null });
    const user = userEvent.setup();
    wrap(
      <CardGrid
        initialItems={[video(1), video(2)]}
        total={4}
        nextCursor="2"
        inList={[]}
        loadMore={loadMore}
        countLabel="videos"
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Show more' }));
    await waitFor(() => expect(screen.getAllByRole('listitem')).toHaveLength(4));
    expect(loadMore).toHaveBeenCalledWith('2');
    expect(screen.queryByRole('button', { name: 'Show more' })).toBeNull();
  });

  it('shows an inline error and lets the user retry without losing the cards', async () => {
    const loadMore = vi
      .fn<(cursor: string) => Promise<Page<CatalogItem>>>()
      .mockRejectedValueOnce(new Error('x'))
      .mockResolvedValue({ items: [video(3)], total: 3, nextCursor: null });
    const user = userEvent.setup();
    wrap(
      <CardGrid
        initialItems={[video(1), video(2)]}
        total={3}
        nextCursor="2"
        inList={[]}
        loadMore={loadMore}
        countLabel="videos"
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Show more' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not load more videos.');
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    await user.click(screen.getByRole('button', { name: 'Show more' }));
    await waitFor(() => expect(screen.getAllByRole('listitem')).toHaveLength(3));
  });

  it('locks the button while loading', async () => {
    let resolve: (page: Page<CatalogItem>) => void = () => {};
    const loadMore = vi.fn(() => new Promise<Page<CatalogItem>>((r) => (resolve = r)));
    const user = userEvent.setup();
    wrap(
      <CardGrid
        initialItems={[video(1)]}
        total={2}
        nextCursor="1"
        inList={[]}
        loadMore={loadMore}
        countLabel="videos"
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Show more' }));
    expect(screen.getByRole('button', { name: /Loading/ })).toHaveAttribute('aria-busy', 'true');
    resolve({ items: [video(2)], total: 2, nextCursor: null });
    await waitFor(() => expect(screen.getAllByRole('listitem')).toHaveLength(2));
  });

  it('labels each card Video or Series when asked', () => {
    const series: CatalogItem = {
      kind: 'series',
      slug: 'farming',
      title: 'Farming basics',
      description: 'd',
      episodeCount: 4,
      seasonCount: 1,
      categorySlug: 'c',
      categoryName: 'C',
      kidsSafe: true,
      hasCaptions: false,
      publishedAt: '',
    } as never;
    wrap(
      <CardGrid
        initialItems={[video(1), series]}
        total={2}
        nextCursor={null}
        inList={[]}
        loadMore={vi.fn()}
        countLabel="results"
        showType
      />,
    );
    const items = screen.getAllByRole('listitem');
    expect(items[0]).toHaveTextContent('Video');
    expect(items[1]).toHaveTextContent('Series');
  });

  it('shows no type label by default', () => {
    wrap(
      <CardGrid
        initialItems={[video(1)]}
        total={1}
        nextCursor={null}
        inList={[]}
        loadMore={vi.fn()}
        countLabel="videos"
      />,
    );
    expect(screen.getAllByRole('listitem')[0]).not.toHaveTextContent(/^Video$/);
  });
});
