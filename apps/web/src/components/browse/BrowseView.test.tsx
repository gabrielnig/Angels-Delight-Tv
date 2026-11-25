// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { msg as translate } from '@ad/shared/messages';

vi.mock('../../lib/i18n/server', () => ({
  getLocale: async () => 'en',
  getTranslator: async () => translate,
}));
vi.mock('../../lib/data', () => ({
  getCatalog: () => ({
    categories: async () => [
      { id: 'c1', slug: 'science', name: 'Science', description: null },
      { id: 'c2', slug: 'maths', name: 'Maths', description: null },
    ],
    browse: async () => ({ items: [], total: 0, nextCursor: null }),
  }),
  getLibrary: () => ({ myListIds: async () => [] }),
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: () => {} }) }));
const gate = vi.hoisted(() => ({ hold: false }));
vi.mock('./BrowseResults', async () => {
  const { use } = await import('react');
  return {
    BrowseCount: () => {
      if (gate.hold) use(new Promise(() => {}));
      return <>34 videos</>;
    },
    BrowseResults: () => {
      if (gate.hold) use(new Promise(() => {}));
      return <ul aria-label="Videos" />;
    },
  };
});

import { BrowseView } from './BrowseView';

const ctx = {} as never;

describe('BrowseView category rail (L11 slice 1)', () => {
  beforeEach(() => {
    gate.hold = false;
  });

  it('shows one category rail with All first and the current category marked', async () => {
    render(await BrowseView({ ctx, categorySlug: 'maths', length: 'any', sort: 'newest' }));
    const nav = screen.getByRole('navigation', { name: 'Categories' });
    const links = nav.querySelectorAll('a');
    expect([...links].map((a) => a.textContent)).toEqual(['All', 'Science', 'Maths']);
    expect(screen.getByRole('link', { name: 'Maths' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'All' })).toHaveAttribute('href', '/browse');
  });

  it('has no old chip rows: Length and Sort are two menu buttons and the page has one filter bar', async () => {
    render(await BrowseView({ ctx, length: 'any', sort: 'newest' }));
    expect(screen.getAllByRole('group', { name: 'Filters' })).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: /^(Length|Sort by):/ })).toHaveLength(2);
    expect(screen.queryByRole('group', { name: 'Length' })).toBeNull();
    expect(screen.queryByRole('list', { name: 'Active filters' })).toBeNull();
  });

  it('keeps the chosen length and sort when a category is chosen', async () => {
    render(await BrowseView({ ctx, length: 'short', sort: 'az' }));
    expect(screen.getByRole('link', { name: 'Science' })).toHaveAttribute(
      'href',
      '/browse/science?length=short&sort=az',
    );
  });

  it('puts the count beside the title in a polite live region', async () => {
    render(await BrowseView({ ctx, length: 'any', sort: 'newest' }));
    const count = screen.getByText('34 videos');
    expect(count.closest('[aria-live="polite"]')).not.toBeNull();
    expect(screen.getByRole('heading', { level: 1, name: 'Browse' })).toBeInTheDocument();
  });

  it('while results load, the title, rail and bar stay and a skeleton holds the grid height', async () => {
    gate.hold = true;
    const { container } = render(await BrowseView({ ctx, length: 'any', sort: 'newest' }));
    // The region holds the height at once. Its shapes appear after 300 ms (BrowseSkeleton.test.tsx).
    expect(screen.getByRole('heading', { level: 1, name: 'Browse' })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Categories' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Filters' })).toBeInTheDocument();
    expect(container.querySelector('.web-browse-skeleton')).not.toBeNull();
    expect(screen.queryByRole('list', { name: 'Videos' })).toBeNull();
  });
});

describe('BrowseView kids profile (L11 slice 3)', () => {
  it('shows only the categories the catalog gives this profile, in the same layout', async () => {
    gate.hold = false;
    render(await BrowseView({ ctx: { kids: true } as never, length: 'any', sort: 'newest' }));
    const rail = screen.getByRole('navigation', { name: 'Categories' });
    expect([...rail.querySelectorAll('a')].map((a) => a.textContent)).toEqual([
      'All',
      'Science',
      'Maths',
    ]);
    expect(screen.getAllByRole('group', { name: 'Filters' })).toHaveLength(1);
  });
});
