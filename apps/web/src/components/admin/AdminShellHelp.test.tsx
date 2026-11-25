// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

let pathname = '/admin/videos';
vi.mock('next/navigation', () => ({ usePathname: () => pathname }));
vi.mock('./UploaderContext', () => ({
  useUploaderState: () => ({ lanes: [], online: true, uploader: {} }),
  summarizeUploads: () => ({ count: 0, percent: 0 }),
}));

const { AdminShell } = await import('./AdminShell');
const { HelpMapProvider } = await import('./help/HelpMapProvider');

afterEach(cleanup);
const base = {
  platformName: 'Test TV',
  counts: { encoding: 0, captions: 0 },
  signOut: async () => {},
};
const shell = (role: 'editor' | 'admin' | 'super_admin') => (
  <HelpMapProvider map={{ '/admin/videos': ['D10'] }}>
    <AdminShell {...base} actor={{ name: 'Ngozi Eze', role, roleLabel: 'Staff' }}>
      x
    </AdminShell>
  </HelpMapProvider>
);

describe('AdminShell help entry points (M50-S01)', () => {
  it.each(['editor', 'admin', 'super_admin'] as const)(
    'pins a Help centre item in the side menu for %s',
    (role) => {
      pathname = '/admin/videos';
      render(shell(role));
      const side = screen.getByRole('complementary', { name: 'Admin menu' });
      expect(within(side).getByRole('link', { name: 'Help centre' })).toHaveAttribute(
        'href',
        '/admin/help',
      );
    },
  );

  it('has a Help button in the top bar that opens the article for this screen', () => {
    pathname = '/admin/videos';
    render(shell('editor'));
    const top = screen.getByRole('banner');
    expect(within(top).getByRole('link', { name: 'Help' })).toHaveAttribute(
      'href',
      '/admin/help/D10',
    );
  });

  it('marks the Help centre item as current on help pages and hides the video search', () => {
    pathname = '/admin/help/D02';
    render(shell('editor'));
    expect(screen.getByRole('link', { name: 'Help centre' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.queryByRole('searchbox', { name: 'Search videos' })).toBeNull();
  });

  it('keeps the video search on other pages', () => {
    pathname = '/admin/videos';
    render(shell('editor'));
    expect(screen.getByRole('searchbox', { name: 'Search videos' })).toBeInTheDocument();
  });

  it('opens the help panel from the top bar button when the shell is given a loader', async () => {
    pathname = '/admin/videos';
    const load = async () => ({
      ok: true as const,
      data: { pathname: '/admin/videos', guides: [], core: [] },
      cues: [],
    });
    render(
      <HelpMapProvider map={{ '/admin/videos': ['D10'] }}>
        <AdminShell
          {...base}
          actor={{ name: 'Ngozi Eze', role: 'editor', roleLabel: 'Staff' }}
          help={{ load, onWatched: async () => ({ ok: true }) }}
        >
          x
        </AdminShell>
      </HelpMapProvider>,
    );
    fireEvent.click(within(screen.getByRole('banner')).getByRole('link', { name: 'Help' }));
    expect(await screen.findByRole('dialog', { name: 'Help for this screen' })).toBeInTheDocument();
  });
});
