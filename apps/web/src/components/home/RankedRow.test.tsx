// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@ad/ui';
import type { CatalogItem, HomeRow } from '../../lib/data';
import { RANKED_KINDS, RankedRow } from './RankedRow';

vi.mock('../../app/actions', () => ({
  toggleListAction: vi.fn(),
  restoreContinueAction: vi.fn(),
  removeContinueAction: vi.fn(),
}));

const item = (n: number): CatalogItem => ({
  kind: 'video',
  id: `v${n}`,
  slug: `s${n}`,
  title: `Video ${n}`,
  description: 'd',
  durationSeconds: 120,
  categorySlug: 'c',
  categoryName: 'Science',
  hasCaptions: false,
  kidsSafe: true,
  publishedAt: '',
});

const row = (kind: HomeRow['kind'], count = 4): HomeRow => ({
  id: `r-${kind}`,
  kind,
  title: kind === 'top_ten' ? 'Top 10 on Angels Delight TV' : 'Row',
  items: Array.from({ length: count }, (_, i) => item(i + 1)),
});

const view = (r: HomeRow) =>
  render(
    <ToastProvider>
      <RankedRow row={r} inList={new Set()} />
    </ToastProvider>,
  );

describe('RankedRow', () => {
  it('knows the three kinds it draws', () => {
    expect([...RANKED_KINDS].sort()).toEqual(['most_liked', 'top_ten', 'trending']);
  });

  it('draws Top 10 as an ordered list, numerals hidden, each link starting Number N,', () => {
    const { container } = view(row('top_ten', 10));
    expect(container.querySelector('ol.ad-row__list')).not.toBeNull();
    const links = screen.getAllByRole('link').filter((l) => /Video/.test(l.textContent ?? ''));
    expect(links[2]).toHaveAccessibleName(/^Number 3,\s?Video 3/);
    expect(container.querySelectorAll('.ad-ranked__num[aria-hidden="true"]')).toHaveLength(10);
    expect(container.querySelectorAll('.ad-ranked__num')[2]).toHaveTextContent('3');
  });

  it('has a real h2 heading with the row title', () => {
    view(row('top_ten'));
    expect(
      screen.getByRole('heading', { level: 2, name: 'Top 10 on Angels Delight TV' }),
    ).toBeInTheDocument();
  });

  it('draws Trending now as a plain card row with no numerals', () => {
    const { container } = view(row('trending'));
    expect(container.querySelector('ul.ad-row__list')).not.toBeNull();
    expect(container.querySelector('.ad-ranked__num')).toBeNull();
    const link = screen.getAllByRole('link')[0]!;
    expect(link).not.toHaveAccessibleName(/Number/);
  });

  it('draws Most liked as a plain card row', () => {
    const { container } = view(row('most_liked'));
    expect(container.querySelector('.ad-ranked__num')).toBeNull();
    expect(within(container).getAllByRole('listitem')).toHaveLength(4);
  });

  it('draws nothing for an empty row', () => {
    const { container } = view(row('trending', 0));
    expect(container.querySelector('section')).toBeNull();
  });
});
