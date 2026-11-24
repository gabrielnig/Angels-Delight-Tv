// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@ad/ui';
import type { CatalogItem } from '../../lib/data';
import { ListPageError, ListPageView } from './ListPageView';

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

describe('ListPageView', () => {
  it('shows the list title as the page heading with its titles', () => {
    wrap(
      <ListPageView
        list="new"
        title="New this week"
        items={[video(1), video(2)]}
        total={2}
        nextCursor={null}
        inList={[]}
      />,
    );
    expect(screen.getByRole('heading', { level: 1, name: 'New this week' })).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });

  it('offers the new titles page from an empty list', () => {
    wrap(<ListPageView list="row" title="Picks" items={[]} total={0} nextCursor={null} inList={[]} />);
    expect(screen.getByRole('heading', { name: 'Nothing here yet' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /new/i })).toHaveAttribute('href', '/browse/new');
  });

  it('says what an empty Trending page means', () => {
    wrap(
      <ListPageView list="trending" title="Trending" items={[]} total={0} nextCursor={null} inList={[]} />,
    );
    expect(screen.getByText('Nothing is trending yet. See what is new.')).toBeInTheDocument();
  });
});

describe('ListPageError', () => {
  it('has one Retry action that calls reset', async () => {
    const reset = vi.fn();
    render(<ListPageError reset={reset} />);
    expect(screen.getByRole('heading', { name: 'Could not load this list' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(reset).toHaveBeenCalledTimes(1);
  });
});
