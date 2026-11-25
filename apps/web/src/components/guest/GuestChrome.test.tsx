// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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

  it('offers Home, Browse and My List in the main navigation and Search as an icon link', () => {
    chrome();
    const main = screen.getByRole('navigation', { name: 'Main' });
    for (const name of ['Home', 'Browse', 'My List'])
      expect(within(main).getByRole('link', { name })).toBeInTheDocument();
    const bar = screen.getByRole('banner');
    expect(within(bar).getByRole('link', { name: 'Search' })).toHaveAttribute('href', '/search');
  });

  it('has the phone skeleton: logo, search and one account icon, with no Sign in button label on the bar itself', () => {
    chrome();
    const tools = document.querySelector('.ad-nav__tools') as HTMLElement;
    expect(within(tools).getByRole('link', { name: 'Search' })).toBeInTheDocument();
    expect(within(tools).getByRole('button', { name: 'Account menu' })).toBeInTheDocument();
    // The wide bar buttons live in the container phones hide.
    const wide = tools.querySelector('.ad-nav__guest') as HTMLElement;
    expect(within(wide).getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/sign-in');
  });

  it('shows Sign in and, only when sign up is open, Create account in the account menu', async () => {
    const view = chrome();
    await userEvent.click(screen.getByRole('button', { name: 'Account menu' }));
    const menu = screen.getByRole('menu');
    expect(within(menu).getByRole('menuitem', { name: 'Sign in' })).toHaveAttribute(
      'href',
      '/sign-in',
    );
    expect(within(menu).getByRole('menuitem', { name: 'Create account' })).toHaveAttribute(
      'href',
      '/sign-up',
    );
    view.unmount();
    chrome({ signUpOpen: false });
    await userEvent.click(screen.getByRole('button', { name: 'Account menu' }));
    expect(screen.queryByRole('menuitem', { name: 'Create account' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Create account' })).toBeNull();
  });

  it('hides the header and the tab bar on the watch page', () => {
    nav.pathname = '/watch/how-rain-is-made';
    chrome();
    expect(screen.queryByRole('banner')).toBeNull();
    expect(screen.queryByRole('navigation', { name: 'Primary' })).toBeNull();
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

  it('shows the logo mark and a Kids badge in Kids mode, labelled by the platform name, with no way to Create account', async () => {
    chrome({ kids: true, setKidsMode: vi.fn() });
    expect(screen.getByRole('link', { name: 'Angels Delight TV' })).toBeInTheDocument();
    expect(screen.getByText('Kids')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Create account' })).toBeNull();
    expect(screen.queryByRole('navigation', { name: 'Main' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Account menu' }));
    expect(screen.queryByRole('menuitem', { name: 'Create account' })).toBeNull();
    expect(screen.queryByRole('menuitem', { name: 'Sign in' })).toBeNull();
  });

  it('lets the bar sit clear over the home hero and solid elsewhere', () => {
    nav.pathname = '/';
    const view = chrome();
    expect(screen.getByRole('banner')).toHaveAttribute('data-hero', 'true');
    view.unmount();
    nav.pathname = '/browse';
    chrome();
    expect(screen.getByRole('banner')).not.toHaveAttribute('data-hero');
    expect(screen.getByRole('banner')).toHaveAttribute('data-surface', 'solid');
  });

  describe('Kids mode (R17)', () => {
    it('has a Kids mode item and Help in the account menu', async () => {
      const setKidsMode = vi.fn().mockResolvedValue(undefined);
      chrome({ setKidsMode });
      await userEvent.click(screen.getByRole('button', { name: 'Account menu' }));
      expect(screen.getByRole('menuitem', { name: 'Help' })).toHaveAttribute('href', '/help');
      await userEvent.click(screen.getByRole('menuitem', { name: 'Turn on Kids mode' }));
      expect(setKidsMode).toHaveBeenCalledWith(true);
    });

    it('closes the menu with Escape and returns focus to the account button', async () => {
      chrome({ setKidsMode: vi.fn() });
      const button = screen.getByRole('button', { name: 'Account menu' });
      await userEvent.click(button);
      await userEvent.keyboard('{Escape}');
      expect(screen.queryByRole('menu')).toBeNull();
      expect(button).toHaveFocus();
    });

    it('offers Turn off Kids mode in the footer when it is on', async () => {
      const setKidsMode = vi.fn().mockResolvedValue(undefined);
      chrome({ kids: true, setKidsMode });
      await userEvent.click(screen.getByRole('button', { name: 'Turn off Kids mode' }));
      expect(setKidsMode).toHaveBeenCalledWith(false);
    });
  });
});

describe('GuestChrome account sheet on phones (L12)', () => {
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

  it('opens the sheet with Sign in, Create account, the Kids mode switch with its help and Help', async () => {
    const setKidsMode = vi.fn().mockResolvedValue(undefined);
    chrome({ setKidsMode });
    await userEvent.click(screen.getByRole('button', { name: 'Account menu' }));
    const sheet = screen.getByRole('dialog', { name: 'Account' });
    expect(within(sheet).getByRole('link', { name: 'Sign in' })).toHaveAttribute(
      'href',
      '/sign-in',
    );
    expect(within(sheet).getByRole('link', { name: 'Create account' })).toHaveAttribute(
      'href',
      '/sign-up',
    );
    const toggle = within(sheet).getByRole('switch', { name: 'Kids mode' });
    expect(toggle).toHaveAttribute('aria-checked', 'false');
    expect(
      within(sheet).getByText(
        'Shows videos made for children. Anyone using this device can turn it off.',
      ),
    ).toBeInTheDocument();
    await userEvent.click(toggle);
    expect(setKidsMode).toHaveBeenCalledWith(true);
  });

  it('shows only the Kids mode switch and Help when Kids mode is on', async () => {
    chrome({ kids: true, setKidsMode: vi.fn() });
    await userEvent.click(screen.getByRole('button', { name: 'Account menu' }));
    const sheet = screen.getByRole('dialog');
    expect(within(sheet).getByRole('switch', { name: 'Kids mode' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    expect(within(sheet).getByRole('link', { name: 'Help' })).toBeInTheDocument();
    expect(within(sheet).queryByRole('link', { name: 'Sign in' })).toBeNull();
    expect(within(sheet).queryByRole('link', { name: 'Create account' })).toBeNull();
  });
});
