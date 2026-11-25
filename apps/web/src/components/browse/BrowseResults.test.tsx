// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { msg } from '@ad/shared/messages';
import type { CatalogItem, Page } from '../../lib/data';

vi.mock('./BoundGrids', () => ({
  BrowseGrid: ({ initialItems }: { initialItems: CatalogItem[] }) => (
    <ul aria-label="Videos">
      {initialItems.map((i) => (
        <li key={i.slug}>{i.title}</li>
      ))}
    </ul>
  ),
}));

import { BrowseCount, BrowseResults } from './BrowseResults';

const video = (n: number): CatalogItem =>
  ({ kind: 'video', id: `v${n}`, slug: `v-${n}`, title: `Video ${n}` }) as CatalogItem;
const page = (items: CatalogItem[], total = items.length): Promise<Page<CatalogItem>> =>
  Promise.resolve({ items, total, nextCursor: null });
const inList = Promise.resolve<string[]>([]);

async function results(over: Partial<Parameters<typeof BrowseResults>[0]> = {}) {
  return render(
    await BrowseResults({
      msg,
      page: page([video(1), video(2)]),
      inList,
      base: '/browse',
      length: 'any',
      sort: 'newest',
      ...over,
    }),
  );
}

describe('BrowseResults (L11 slice 3)', () => {
  it('shows the grid when there are videos', async () => {
    await results();
    expect(screen.getByRole('list', { name: 'Videos' })).toBeInTheDocument();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('empty category: one action only, back to Home (R39)', async () => {
    await results({ page: page([]) });
    const state = screen.getByRole('heading', { name: 'Nothing here yet' }).parentElement!;
    expect(state).toHaveTextContent('New videos are added often. Try another category.');
    expect(within(state).getAllByRole('link')).toHaveLength(1);
    expect(within(state).getByRole('link', { name: 'Back to Home' })).toHaveAttribute('href', '/');
    expect(within(state).queryAllByRole('button')).toHaveLength(0);
  });

  it('empty because of the filters: one action only, Clear filters keeps the category (R39)', async () => {
    await results({ page: page([]), base: '/browse/science', length: 'long', sort: 'az' });
    const state = screen.getByRole('heading', { name: 'No videos match these filters' }).parentElement!;
    expect(state).toHaveAttribute('role', 'status');
    expect(state).toHaveTextContent('Try a different length or clear your filters.');
    const links = within(state).getAllByRole('link');
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveTextContent('Clear filters');
    // the same reset as Clear in the bar: length and sort both go back to their defaults
    expect(links[0]).toHaveAttribute('href', '/browse/science');
  });

  it('a sort alone never makes the empty state a filter state', async () => {
    await results({ page: page([]), sort: 'az' });
    expect(screen.getByRole('heading', { name: 'Nothing here yet' })).toBeInTheDocument();
  });
});

describe('BrowseCount', () => {
  it('says how many videos, with the singular for one', async () => {
    const { container, rerender } = render(await BrowseCount({ msg, page: page([video(1)], 1) }));
    expect(container).toHaveTextContent('1 video');
    rerender(await BrowseCount({ msg, page: page([video(1), video(2)], 34) }));
    expect(container).toHaveTextContent('34 videos');
  });
  it('shows nothing when there are none, the empty state speaks instead', async () => {
    const { container } = render((await BrowseCount({ msg, page: page([]) })) ?? <></>);
    expect(container).toBeEmptyDOMElement();
  });
});
