// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../components/Shell', () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="shell">{children}</div>
  ),
}));
const { default: NotFound } = await import('./not-found');

describe('404 page (M26-S04 AC1)', () => {
  it('says what happened and offers Home and Search inside the app shell', () => {
    render(<NotFound />);
    expect(screen.getByTestId('shell')).toBeInTheDocument();
    expect(screen.getByText('We could not find that page')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to Home' })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: 'Search' })).toHaveAttribute('href', '/search');
  });
});
