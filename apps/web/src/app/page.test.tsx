// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  session: null as unknown,
  guestPlay: true,
  homeCtx: undefined as unknown,
}));
vi.mock('next/navigation', () => ({
  redirect: (to: string) => {
    throw new Error(`redirect:${to}`);
  },
}));
vi.mock('../lib/session', () => ({
  getSession: async () => mocks.session,
  requireProfile: vi.fn(),
}));
vi.mock('../lib/data', () => ({
  getSite: () => ({ content: async () => ({ signUpOpen: true, platformName: 'AD' }) }),
}));
vi.mock('../server/guest/guest-settings', () => ({
  guestPlayEnabled: async () => mocks.guestPlay,
}));
vi.mock('../server/guest/guest-view', () => ({
  currentGuestAudience: async () => 'adult',
}));
vi.mock('../server/auth/turnstile-site', () => ({ turnstileSiteKey: () => undefined }));
vi.mock('../components/Shell', () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock('../components/AuthLayouts', () => ({
  AuthSplit: ({ children }: { children: React.ReactNode }) => <div>auth split{children}</div>,
}));
vi.mock('../components/auth/AuthScreens', () => ({ SignInScreen: () => <p>sign in card</p> }));
vi.mock('../components/home/HomeView', () => ({
  HomeSkeleton: () => null,
  HomeView: (props: { ctx: { guest?: boolean } }) => {
    mocks.homeCtx = props.ctx;
    return <p>home view</p>;
  },
}));

import RootPage from './page';

describe('root page', () => {
  beforeEach(() => {
    mocks.session = null;
    mocks.guestPlay = true;
    mocks.homeCtx = undefined;
  });

  it('shows Home to a visitor without an account', async () => {
    render(await RootPage());
    expect(screen.getByText('home view')).toBeInTheDocument();
    expect(mocks.homeCtx).toMatchObject({ guest: true });
  });

  it('keeps the sign in landing when guest play is off', async () => {
    mocks.guestPlay = false;
    render(await RootPage());
    expect(screen.getByText('sign in card')).toBeInTheDocument();
  });
});
