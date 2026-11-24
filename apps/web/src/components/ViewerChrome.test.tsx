// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

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

import { ViewerChrome } from './ViewerChrome';

const chrome = () =>
  render(
    <ViewerChrome
      platformName="Angels Delight TV"
      profileName="Chidi"
      profileId="p1"
      kids={false}
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
