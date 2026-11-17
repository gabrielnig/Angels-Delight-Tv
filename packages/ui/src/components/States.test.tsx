import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { EmptyState, ErrorState } from './States';

describe('EmptyState', () => {
  it('has a headline, one sentence and one action', () => {
    render(
      <EmptyState
        title="Your list is empty."
        description="Tap the plus on any video to save it for later."
        action={{ label: 'Browse videos', href: '/browse' }}
      />,
    );
    expect(screen.getByRole('heading', { name: 'Your list is empty.' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Browse videos' })).toHaveAttribute('href', '/browse');
  });

  it('announces itself only when it appears after a user action', () => {
    const { rerender } = render(<EmptyState title="Nothing here yet." />);
    expect(screen.queryByRole('status')).toBeNull();
    rerender(<EmptyState title="Nothing here yet." live />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });
});

describe('ErrorState', () => {
  it('says what happened and offers a retry', async () => {
    const onRetry = vi.fn();
    render(
      <ErrorState
        title="Could not load this row."
        description="Try again."
        onRetry={onRetry}
        retryLabel="Try again"
      />,
    );
    await userEvent.setup().click(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalled();
  });

  it('uses role alert for inline errors and shows a reference code', () => {
    render(<ErrorState title="Something went wrong." reference="AD-4F2A" />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText('Reference: AD-4F2A')).toBeInTheDocument();
  });

  it('page variant uses a level one heading that can take focus', () => {
    render(<ErrorState variant="page" title="We could not find that page." />);
    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading).toHaveAttribute('tabindex', '-1');
  });

  it('banner variant is not a heading', () => {
    render(<ErrorState variant="banner" title="Search is not working right now." />);
    expect(screen.queryByRole('heading')).toBeNull();
    expect(screen.getByRole('alert')).toHaveTextContent('Search is not working right now.');
  });
});
