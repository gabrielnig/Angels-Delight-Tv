// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
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
vi.mock('./BoundGrids', () => ({ BrowseGrid: () => null }));

import { BrowseView } from './BrowseView';

const ctx = {} as never;

describe('BrowseView category rail (L11 slice 1)', () => {
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
});
