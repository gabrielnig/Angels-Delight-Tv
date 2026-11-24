// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../components/Shell', () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <div data-testid="shell">{children}</div>,
}));
vi.mock('../components/errors/NotFoundSuggestions', () => ({
  NotFoundSuggestions: ({ heading }: { heading: string }) => <h2>{heading}</h2>,
  SuggestionsSkeleton: () => <i data-testid="skeleton" />,
}));
vi.mock('../lib/analytics/browser', () => ({ getAnalyticsClient: () => ({ track: vi.fn() }) }));
vi.mock('../lib/data/pwa-settings', () => ({ getPwaSettings: async () => ({ name: 'ADTV' }) }));
vi.mock('../components/pwa/SavedPageLinks', () => ({
  SavedPageLinks: () => (
    <nav aria-label="Saved pages">
      <a href="/about">About</a>
    </nav>
  ),
}));

const actions = (c: HTMLElement) => c.querySelectorAll('.ad-error a, .ad-error button');

describe('one action on every error page (R39, M45-S14)', () => {
  it('404: Back to Home only, with search and popular titles, noindex', async () => {
    const mod = await import('./not-found');
    const { container } = render(await mod.default());
    expect(screen.getByRole('heading', { level: 1, name: 'We could not find that page' })).toBeInTheDocument();
    expect(actions(container)).toHaveLength(1);
    expect(screen.getByRole('link', { name: 'Back to Home' })).toHaveAttribute('href', '/');
    expect(screen.getByRole('searchbox')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Popular right now' })).toBeInTheDocument();
    expect(mod.metadata.robots).toMatchObject({ index: false });
  });

  it('removed video: says it is gone, Back to Home only, more like this', async () => {
    const mod = await import('./(viewer)/title/[slug]/not-found');
    const { container } = render(await mod.default());
    expect(screen.getByRole('heading', { level: 1, name: 'This video is no longer available' })).toBeInTheDocument();
    expect(actions(container)).toHaveLength(1);
    expect(screen.getByRole('link', { name: 'Back to Home' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'More like this' })).toBeInTheDocument();
    expect(mod.metadata.robots).toMatchObject({ index: false });
  });

  it('removed series: same, with series wording', async () => {
    const mod = await import('./(viewer)/series/[slug]/not-found');
    const { container } = render(await mod.default());
    expect(screen.getByRole('heading', { level: 1, name: 'This series is no longer available' })).toBeInTheDocument();
    expect(actions(container)).toHaveLength(1);
  });

  it('server error: Try again only, reference and support email as plain text, no Report link', async () => {
    const { default: ErrorRoute } = await import('./error');
    const reset = vi.fn();
    const { container } = render(<ErrorRoute error={Object.assign(new Error('secret'), { digest: 'abc123' })} reset={reset} />);
    expect(screen.getByRole('heading', { level: 1, name: 'Something went wrong on our side' })).toBeInTheDocument();
    expect(actions(container)).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
    expect(container).toHaveTextContent('Reference: abc123');
    expect(container).not.toHaveTextContent('secret');
    expect(screen.queryByRole('link', { name: /report|home/i })).toBeNull();
    expect(container.querySelector('a[href^="mailto:"]')).toBeNull();
  });

  it('root error: a minimal page with one Reload button, no links', async () => {
    const { default: GlobalError } = await import('./global-error');
    const markup = renderToStaticMarkup(
      <GlobalError error={Object.assign(new Error('x'), { digest: 'AD-9C31' })} reset={vi.fn()} />,
    );
    const doc = new DOMParser().parseFromString(markup, 'text/html');
    expect(doc.querySelectorAll('button')).toHaveLength(1);
    expect(doc.querySelector('button')?.textContent).toBe('Reload the page');
    expect(doc.querySelectorAll('a')).toHaveLength(0);
    expect(doc.body.textContent).toContain('Reference: AD-9C31');
    expect(doc.querySelector('meta[name="robots"]')?.getAttribute('content')).toMatch(/noindex/);
    expect(markup).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });

  it('offline: a status banner and Try again only, saved pages stay outside the message', async () => {
    const mod = await import('./offline/page');
    const { container } = render(await mod.default());
    expect(screen.getByRole('heading', { level: 1, name: 'You are offline' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('You are offline. Check your data or Wi-Fi.');
    expect(actions(container)).toHaveLength(1);
    expect(screen.getByRole('link', { name: 'Try again' })).toHaveAttribute('href', '/');
    expect(mod.metadata.robots).toMatchObject({ index: false });
  });
});
