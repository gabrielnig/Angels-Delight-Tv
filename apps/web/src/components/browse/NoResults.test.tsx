// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@ad/ui';
import { NoResults } from './NoResults';

vi.mock('../../app/actions', () => ({
  toggleListAction: vi.fn(),
  restoreContinueAction: vi.fn(),
  removeContinueAction: vi.fn(),
}));

const popular = [
  {
    kind: 'video' as const,
    id: 'v1',
    slug: 'rivers',
    title: 'Rivers',
    description: 'd',
    durationSeconds: 60,
    categorySlug: 'c',
    categoryName: 'C',
    hasCaptions: false,
    kidsSafe: true,
    publishedAt: '',
  },
];

describe('NoResults', () => {
  it('names the query, gives tips and shows popular titles', () => {
    render(
      <ToastProvider>
        <NoResults query="xyz" popular={popular} inList={[]} />
      </ToastProvider>,
    );
    expect(screen.getByRole('heading', { name: 'No results for "xyz"' })).toBeInTheDocument();
    expect(screen.getByText(/check the spelling/i)).toBeInTheDocument();
    expect(screen.getByText(/fewer words/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Popular right now' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Rivers/ })).toBeInTheDocument();
  });

  it('shows no popular row when there are none', () => {
    render(
      <ToastProvider>
        <NoResults query="xyz" popular={[]} inList={[]} />
      </ToastProvider>,
    );
    expect(screen.queryByRole('heading', { name: 'Popular right now' })).toBeNull();
  });

  it('shows subject chips and one action each, never a second button (M45-S09)', () => {
    render(
      <ToastProvider>
        <NoResults
          query="xyz"
          popular={popular}
          inList={[]}
          subjects={[
            { slug: 'money', name: 'Money' },
            { slug: 'farming', name: 'Farming' },
          ]}
        />
      </ToastProvider>,
    );
    const chips = screen.getByRole('navigation', { name: 'Subjects' });
    expect(chips.querySelectorAll('a')).toHaveLength(2);
    expect(screen.getByRole('link', { name: 'Money' })).toHaveAttribute('href', '/browse/money');
    expect(screen.queryByRole('link', { name: 'Browse categories' })).toBeNull();
  });

  it('puts a did you mean link in the empty state when one exists', () => {
    render(
      <ToastProvider>
        <NoResults query="xyz" popular={[]} inList={[]} didYouMean="xylophone" />
      </ToastProvider>,
    );
    expect(screen.getByRole('link', { name: 'xylophone' })).toHaveAttribute('href', '/search?q=xylophone');
  });
});
