// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  session: null as unknown,
  guestPlay: true,
  audience: 'adult' as 'adult' | 'kids',
}));
vi.mock('next/navigation', () => ({
  usePathname: () => '/browse',
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), back: vi.fn() }),
}));
vi.mock('../lib/data', () => ({
  getSite: () => ({
    content: async () => ({
      platformName: 'Angels Delight TV',
      footerLinks: [],
      signUpOpen: true,
    }),
  }),
}));
vi.mock('../lib/session', () => ({ getSession: async () => mocks.session }));
vi.mock('../server/guest/guest-settings', () => ({
  guestPlayEnabled: async () => mocks.guestPlay,
}));
vi.mock('../server/guest/guest-view', () => ({ currentGuestAudience: async () => mocks.audience }));
vi.mock('../lib/i18n/picker-data', () => ({ pickerData: async () => null }));
vi.mock('../lib/i18n/server', async () => {
  const { msg } = await import('@ad/shared/messages');
  return { getLocale: async () => 'en', getTranslator: async () => msg };
});
vi.mock('./ViewerChrome', () => ({ ViewerChrome: () => <p>viewer chrome</p> }));

import { AppShell } from './Shell';

const shell = async () => render(await AppShell({ children: <p>page</p> }));

describe('AppShell', () => {
  beforeEach(() => {
    mocks.session = null;
    mocks.guestPlay = true;
    mocks.audience = 'adult';
  });

  it('gives a visitor without an account the guest chrome', async () => {
    await shell();
    expect(screen.getByRole('navigation', { name: 'Main' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Sign in' })).toBeInTheDocument();
  });

  it('keeps the viewer chrome for a signed in profile', async () => {
    mocks.session = { profile: { id: 'p', name: 'A', kids: false } };
    await shell();
    expect(screen.getByText('viewer chrome')).toBeInTheDocument();
  });

  it('falls back to the light public header when guest play is off', async () => {
    mocks.guestPlay = false;
    await shell();
    expect(screen.queryByRole('navigation', { name: 'Main' })).toBeNull();
    expect(screen.getByRole('navigation', { name: 'Account' })).toBeInTheDocument();
  });

  it('shows the logo mark alone in Kids mode', async () => {
    mocks.audience = 'kids';
    await shell();
    expect(screen.queryByRole('navigation', { name: 'Main' })).toBeNull();
  });
});
