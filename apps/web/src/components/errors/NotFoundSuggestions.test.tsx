// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const popular = vi.fn();
vi.mock('../../lib/data', () => ({ getCatalog: () => ({ popular }) }));
vi.mock('../../lib/session', () => ({ getViewerOrGuest: async () => ({ ctx: { audience: 'general' } }) }));
vi.mock('../CatalogCard', () => ({
  CatalogCard: ({ item }: { item: { title: string } }) => <a href="/x">{item.title}</a>,
}));

const { NotFoundSuggestions, SuggestionsSkeleton } = await import('./NotFoundSuggestions');

describe('NotFoundSuggestions (M45-S14)', () => {
  it('lists popular titles under the heading it is given', async () => {
    popular.mockResolvedValue([{ title: 'Rivers', type: 'video', id: '1' }]);
    render(await NotFoundSuggestions({ heading: 'More like this' }));
    expect(screen.getByRole('heading', { name: 'More like this' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Rivers' })).toBeInTheDocument();
  });

  it('renders nothing when none load or the lookup fails', async () => {
    popular.mockResolvedValue([]);
    expect(await NotFoundSuggestions({ heading: 'x' })).toBeNull();
    popular.mockRejectedValue(new Error('down'));
    expect(await NotFoundSuggestions({ heading: 'x' })).toBeNull();
  });

  it('has a skeleton with five 16 by 9 cards, marked busy', () => {
    const { container } = render(<SuggestionsSkeleton delayMs={0} />);
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(container.querySelectorAll('.ad-error-sk')).toHaveLength(5);
  });
});
