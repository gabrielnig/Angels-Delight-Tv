// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const nav = vi.hoisted(() => ({ pathname: '/browse', back: vi.fn() }));
vi.mock('next/navigation', () => ({
  usePathname: () => nav.pathname,
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), back: nav.back }),
}));
vi.mock('../app/actions', () => ({ signOutAction: vi.fn() }));
vi.mock('./pwa/QueueSync', () => ({ QueueSync: () => null }));
vi.mock('./KidsExitDialog', () => ({ KidsExitDialog: () => null }));
vi.mock('./guest/GuestIntentApplier', () => ({ GuestIntentApplier: () => null }));
vi.mock('./guest/ImportPrompt', () => ({ ImportPrompt: () => null }));
vi.mock('./notices/ViewerBell', () => ({
  ViewerBell: ({ profileId }: { profileId: string }) => <span data-testid="bell">{profileId}</span>,
}));

import { ViewerChrome } from './ViewerChrome';

const chrome = (kids = false) =>
  render(
    <ViewerChrome
      platformName="Angels Delight TV"
      profileName="Chidi"
      profileId="p1"
      kids={kids}
      footerLinks={[]}
      year={2026}
    >
      <p>page</p>
    </ViewerChrome>,
  );

describe('ViewerChrome on title pages (S18)', () => {
  beforeEach(() => nav.back.mockClear());

  it('shows the tab bar and no Back button on other pages', () => {
    nav.pathname = '/browse';
    chrome();
    expect(screen.getByRole('navigation', { name: 'Primary' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Back' })).toBeNull();
  });

  it('swaps the tab bar for a Back button on a title page', async () => {
    nav.pathname = '/title/how-rain-is-made';
    chrome();
    expect(screen.queryByRole('navigation', { name: 'Primary' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(nav.back).toHaveBeenCalled();
  });
});

describe('ViewerChrome bell slot (M44-S11, S17)', () => {
  it('renders the bell for an adult profile and keeps the language picker beside it', () => {
    nav.pathname = '/browse';
    chrome();
    expect(screen.getByTestId('bell')).toHaveTextContent('p1');
  });

  it('renders no bell on a Kids profile', () => {
    nav.pathname = '/browse';
    chrome(true);
    expect(screen.queryByTestId('bell')).toBeNull();
  });
});

describe('ViewerChrome phone header (L12, S183)', () => {
  it('marks the bar for a bell so the name can step aside, and not for a Kids profile', () => {
    nav.pathname = '/browse';
    const view = chrome();
    expect(screen.getByRole('banner')).toHaveAttribute('data-bell', 'true');
    view.unmount();
    chrome(true);
    expect(screen.getByRole('banner')).not.toHaveAttribute('data-bell');
  });

  it('shows the Kids word badge and the profile button named for a Kids profile', () => {
    nav.pathname = '/browse';
    chrome(true);
    expect(screen.getByText('Kids')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Profile menu, Chidi, Kids profile' }),
    ).toBeInTheDocument();
  });

  it('names the profile button for an adult with the profile name', () => {
    nav.pathname = '/browse';
    chrome();
    expect(screen.getByRole('button', { name: 'Profile menu, Chidi' })).toBeInTheDocument();
  });

  it('draws no header and no tab bar on the watch page', () => {
    nav.pathname = '/watch/how-rain-is-made';
    chrome();
    expect(screen.queryByRole('banner')).toBeNull();
    expect(screen.queryByRole('navigation', { name: 'Primary' })).toBeNull();
  });
});

describe('ViewerChrome profile sheet on phones (L12)', () => {
  beforeEach(() => {
    nav.pathname = '/browse';
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: /max-width: 599px/.test(query),
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }));
  });
  afterEach(() => vi.unstubAllGlobals());

  it('opens a bottom sheet with the profile name, kind and the real menu items in order', async () => {
    chrome();
    await userEvent.click(screen.getByRole('button', { name: 'Profile menu, Chidi' }));
    const sheet = screen.getByRole('dialog', { name: 'Chidi' });
    expect(within(sheet).getByText('Adult profile')).toBeInTheDocument();
    const rows = within(sheet)
      .getAllByRole('listitem')
      .map((row) => row.textContent);
    expect(rows).toEqual([
      'Switch profile',
      'Manage profiles',
      'Account',
      'Playback settings',
      'Help',
      'Sign out',
    ]);
  });

  it('labels a Kids profile sheet and keeps Switch profile and Exit kids mode only', async () => {
    chrome(true);
    await userEvent.click(
      screen.getByRole('button', { name: 'Profile menu, Chidi, Kids profile' }),
    );
    const sheet = screen.getByRole('dialog', { name: 'Chidi' });
    expect(within(sheet).getByText('Kids profile')).toBeInTheDocument();
    expect(
      within(sheet)
        .getAllByRole('listitem')
        .map((row) => row.textContent),
    ).toEqual(['Switch profile', 'Exit kids mode']);
  });
});
