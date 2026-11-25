// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

let pathname: string | null = '/admin/videos/upload';
vi.mock('next/navigation', () => ({ usePathname: () => pathname }));

const { HelpLink } = await import('./HelpLink');
const { HelpMapProvider } = await import('./HelpMapProvider');

afterEach(cleanup);
const map = { '/admin/videos/upload': ['D02'], '/admin/captions/[videoId]': ['D07', 'W07'] };

describe('HelpLink', () => {
  it('opens the main article for the current screen', () => {
    render(
      <HelpMapProvider map={map}>
        <HelpLink />
      </HelpMapProvider>,
    );
    expect(screen.getByRole('link', { name: 'Help' })).toHaveAttribute('href', '/admin/help/D02');
  });

  it('falls back to the help centre when no article explains the screen', () => {
    pathname = '/admin/sponsors';
    render(
      <HelpMapProvider map={map}>
        <HelpLink />
      </HelpMapProvider>,
    );
    expect(screen.getByRole('link', { name: 'Help' })).toHaveAttribute('href', '/admin/help');
  });

  it('works with no provider and draws nothing on the help pages themselves', () => {
    pathname = '/admin/videos';
    render(<HelpLink />);
    expect(screen.getByRole('link', { name: 'Help' })).toHaveAttribute('href', '/admin/help');
    cleanup();
    pathname = '/admin/help/D02';
    render(<HelpLink />);
    expect(screen.queryByRole('link')).toBeNull();
  });
});
