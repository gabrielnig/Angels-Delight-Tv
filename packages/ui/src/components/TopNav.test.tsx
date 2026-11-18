import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { BottomTabBar, SiteFooter, TopNav } from './TopNav';

const links = [
  { label: 'Home', href: '/' },
  { label: 'Browse', href: '/browse' },
  { label: 'My List', href: '/my-list' },
];

const menu = [
  { label: 'Manage profiles', href: '/profiles/manage' },
  { label: 'Account', href: '/account' },
  { label: 'Sign out', onSelect: vi.fn() },
];

describe('TopNav', () => {
  it('starts with a skip link as the first focusable element', async () => {
    const user = userEvent.setup();
    render(
      <TopNav
        brand={{ name: 'Angels Delight TV', href: '/' }}
        links={links}
        currentPath="/"
        profileName="Ada"
        menu={menu}
      />,
    );
    await user.tab();
    expect(screen.getByRole('link', { name: 'Skip to main content' })).toHaveFocus();
    expect(screen.getByRole('link', { name: 'Skip to main content' })).toHaveAttribute(
      'href',
      '#main',
    );
  });

  it('has a Main navigation with the current page marked', () => {
    render(
      <TopNav
        brand={{ name: 'Angels Delight TV', href: '/' }}
        links={links}
        currentPath="/browse/health"
        profileName="Ada"
        menu={menu}
      />,
    );
    const nav = screen.getByRole('navigation', { name: 'Main' });
    expect(within(nav).getByRole('link', { name: 'Browse' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(within(nav).getByRole('link', { name: 'Home' })).not.toHaveAttribute('aria-current');
  });

  it('links the logo home and offers a Search icon link', () => {
    render(
      <TopNav
        brand={{ name: 'Angels Delight TV', href: '/' }}
        links={links}
        currentPath="/"
        profileName="Ada"
        menu={menu}
      />,
    );
    expect(screen.getByRole('link', { name: 'Angels Delight TV, home' })).toHaveAttribute(
      'href',
      '/',
    );
    expect(screen.getByRole('link', { name: 'Search' })).toHaveAttribute('href', '/search');
  });

  it('opens the profile menu, closes on Escape and returns focus', async () => {
    const user = userEvent.setup();
    render(
      <TopNav
        brand={{ name: 'Angels Delight TV', href: '/' }}
        links={links}
        currentPath="/"
        profileName="Ada"
        menu={menu}
      />,
    );
    const trigger = screen.getByRole('button', { name: 'Profile menu, Ada' });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await user.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('menuitem', { name: 'Account' })).toHaveAttribute('href', '/account');
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).toBeNull();
    expect(trigger).toHaveFocus();
  });

  it('runs a menu action such as Sign out', async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(
      <TopNav
        brand={{ name: 'Angels Delight TV', href: '/' }}
        links={links}
        currentPath="/"
        profileName="Ada"
        menu={[{ label: 'Sign out', onSelect }]}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Profile menu, Ada' }));
    await user.click(screen.getByRole('menuitem', { name: 'Sign out' }));
    expect(onSelect).toHaveBeenCalled();
  });

  it('shows a reduced kids header with an exit action', async () => {
    const onExit = vi.fn();
    render(
      <TopNav
        brand={{ name: 'Angels Delight TV', href: '/' }}
        links={links}
        currentPath="/"
        profileName="Tobi"
        menu={menu}
        kids
        onExitKids={onExit}
      />,
    );
    expect(screen.queryByRole('navigation', { name: 'Main' })).toBeNull();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /Profile menu, Tobi/ }));
    expect(screen.getAllByRole('menuitem').map((item) => item.textContent)).toEqual([
      'Switch profile',
      'Exit kids mode',
    ]);
    await user.click(screen.getByRole('menuitem', { name: 'Exit kids mode' }));
    expect(onExit).toHaveBeenCalled();
  });

  it('is solid on pages without a hero and transparent over a hero', () => {
    const { rerender, container } = render(
      <TopNav
        brand={{ name: 'Angels Delight TV', href: '/' }}
        links={links}
        currentPath="/"
        profileName="Ada"
        menu={menu}
      />,
    );
    expect(container.querySelector('header')).toHaveAttribute('data-surface', 'solid');
    rerender(
      <TopNav
        brand={{ name: 'Angels Delight TV', href: '/' }}
        links={links}
        currentPath="/"
        profileName="Ada"
        menu={menu}
        overHero
      />,
    );
    expect(container.querySelector('header')).toHaveAttribute('data-surface', 'clear');
  });
});

describe('BottomTabBar', () => {
  const tabs = [
    { label: 'Home', href: '/', icon: 'home' as const },
    { label: 'Browse', href: '/browse', icon: 'grid' as const },
    { label: 'Search', href: '/search', icon: 'search' as const },
    { label: 'My List', href: '/my-list', icon: 'list' as const },
  ];

  it('is a Primary navigation with four items and the current one marked', () => {
    render(<BottomTabBar tabs={tabs} currentPath="/search" />);
    const nav = screen.getByRole('navigation', { name: 'Primary' });
    expect(within(nav).getAllByRole('link')).toHaveLength(4);
    expect(within(nav).getByRole('link', { name: 'Search' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });
});

describe('SiteFooter', () => {
  it('lists legal links and the platform name and year', () => {
    render(
      <SiteFooter
        platformName="Angels Delight TV"
        year={2026}
        links={[
          { label: 'Terms', href: '/terms' },
          { label: 'Privacy', href: '/privacy' },
          { label: 'About', href: '/about' },
          { label: 'Help', href: '/help' },
        ]}
      />,
    );
    expect(screen.getByRole('link', { name: 'Privacy' })).toHaveAttribute('href', '/privacy');
    expect(screen.getByText(/Angels Delight TV 2026/)).toBeInTheDocument();
  });

  it('shows the illustrated profile avatar instead of a letter when the profile has one (M3)', () => {
    const { container, rerender } = render(
      <TopNav
        brand={{ name: 'Angels Delight TV', href: '/' }}
        links={links}
        currentPath="/"
        profileName="Ada"
        profileAvatarId="sun"
        menu={menu}
      />,
    );
    const avatar = container.querySelector('.ad-nav__avatar .ad-avatar');
    expect(avatar?.getAttribute('data-art')).toBe('sun');
    rerender(
      <TopNav
        brand={{ name: 'Angels Delight TV', href: '/' }}
        links={links}
        currentPath="/"
        profileName="Ada"
        menu={menu}
      />,
    );
    expect(
      container.querySelector('.ad-nav__avatar .ad-avatar')?.getAttribute('data-art'),
    ).toBeNull();
  });
});

describe('TopNav back button (S18 phone)', () => {
  const base = {
    brand: { name: 'Angels Delight TV', href: '/' },
    links,
    currentPath: '/title/a',
    profileName: 'Ada',
    menu,
  };

  it('has no back button by default', () => {
    render(<TopNav {...base} />);
    expect(screen.queryByRole('button', { name: 'Back' })).toBeNull();
  });

  it('shows a Back button before the brand and calls onBack', async () => {
    const onBack = vi.fn();
    const { container } = render(<TopNav {...base} onBack={onBack} />);
    const back = screen.getByRole('button', { name: 'Back' });
    await userEvent.click(back);
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(container.querySelector('header')).toHaveAttribute('data-back', 'true');
    const inner = container.querySelector('.ad-nav__inner')!;
    expect(inner.firstElementChild).toBe(back);
  });
});

describe('soft skin and support footer (S27 to S31)', () => {
  it('marks the header soft and shows the profile name beside the avatar', () => {
    const { container } = render(
      <TopNav
        brand={{ name: 'Angels Delight TV', href: '/' }}
        links={links}
        currentPath="/account"
        profileName="Chinedu"
        menu={menu}
        skin="soft"
      />,
    );
    expect(container.querySelector('header')?.getAttribute('data-skin')).toBe('soft');
    expect(container.querySelector('.ad-nav__avatar-name')?.textContent).toBe('Chinedu');
  });

  it('leaves the default header without a name label', () => {
    const { container } = render(
      <TopNav
        brand={{ name: 'Angels Delight TV', href: '/' }}
        links={links}
        currentPath="/"
        profileName="Chinedu"
        menu={menu}
      />,
    );
    expect(container.querySelector('header')?.hasAttribute('data-skin')).toBe(false);
    expect(container.querySelector('.ad-nav__avatar-name')).toBeNull();
  });

  it('puts the support address before the name and year in the footer', () => {
    const { container } = render(
      <SiteFooter
        platformName="Angels Delight TV"
        year={2026}
        links={[{ label: 'Terms', href: '/terms' }]}
        supportEmail="support@angelsdelight.tv"
      />,
    );
    expect(container.querySelector('.ad-footer__note')?.textContent).toBe(
      'support@angelsdelight.tvAngels Delight TV, 2026',
    );
  });
});
