// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const nav = vi.hoisted(() => ({ pathname: '/browse' }));
vi.mock('next/navigation', () => ({
  usePathname: () => nav.pathname,
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), back: vi.fn() }),
}));

import { GuestChrome } from './GuestChrome';

const chrome = (props: Partial<React.ComponentProps<typeof GuestChrome>> = {}) =>
  render(
    <GuestChrome
      platformName="Angels Delight TV"
      footerLinks={[]}
      year={2026}
      signUpOpen
      {...props}
    >
      <p>page</p>
    </GuestChrome>,
  );

describe('GuestChrome (S81)', () => {
  beforeEach(() => {
    nav.pathname = '/browse';
  });

  it('puts the skip link first and gives the page a main landmark', () => {
    chrome();
    const links = screen.getAllByRole('link');
    expect(links[0]).toHaveTextContent('Skip to main content');
    expect(screen.getByRole('main')).toHaveAttribute('id', 'main');
  });

  it('offers Home, Browse, My List and search in the main navigation', () => {
    chrome();
    const main = screen.getByRole('navigation', { name: 'Main' });
    for (const name of ['Home', 'Browse', 'My List', 'Search'])
      expect(within(main).getByRole('link', { name })).toBeInTheDocument();
  });

  it('shows Sign in and, only when sign up is open, Create account', () => {
    const view = chrome();
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/sign-in');
    expect(screen.getByRole('link', { name: 'Create account' })).toHaveAttribute(
      'href',
      '/sign-up',
    );
    view.unmount();
    chrome({ signUpOpen: false });
    expect(screen.queryByRole('link', { name: 'Create account' })).toBeNull();
  });

  it('has a Primary tab bar except on a title page', () => {
    chrome();
    expect(screen.getByRole('navigation', { name: 'Primary' })).toBeInTheDocument();
  });

  it('drops the tab bar on a title page', () => {
    nav.pathname = '/title/how-rain-is-made';
    chrome();
    expect(screen.queryByRole('navigation', { name: 'Primary' })).toBeNull();
  });

  it('shows only the logo mark in Kids mode, labelled by the platform name', () => {
    chrome({ kids: true });
    expect(screen.getByRole('link', { name: /^Angels Delight TV/ })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Create account' })).toBeNull();
    expect(screen.queryByRole('navigation', { name: 'Main' })).toBeNull();
  });

  it('backs the header over the home hero so links stay readable', () => {
    nav.pathname = '/';
    const { container } = chrome();
    expect(container.querySelector('header')).toHaveAttribute('data-over-hero', 'true');
  });

  it('has no hero backing on other pages', () => {
    const { container } = chrome();
    expect(container.querySelector('header')).not.toHaveAttribute('data-over-hero');
  });
});
