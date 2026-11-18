'use client';

import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Avatar } from './Avatar';
import { cx } from './cx';
import { Icon, type IconName } from './Icon';
import { Link } from './Link';

export interface NavLink {
  label: string;
  href: string;
}

export interface MenuItem {
  label: string;
  href?: string;
  onSelect?: () => void;
}

export function isCurrentPath(currentPath: string, href: string): boolean {
  if (href === '/') return currentPath === '/';
  return currentPath === href || currentPath.startsWith(`${href}/`);
}

export function TopNav({
  brand,
  links,
  currentPath,
  profileName,
  menu,
  searchHref = '/search',
  overHero = false,
  kids = false,
  onExitKids,
  switchHref = '/profiles?switch=1',
  onBack,
}: {
  brand: { name: string; href: string; logoUrl?: string };
  links: NavLink[];
  currentPath: string;
  profileName: string;
  menu: MenuItem[];
  searchHref?: string;
  overHero?: boolean;
  kids?: boolean;
  onExitKids?: () => void;
  switchHref?: string;
  /** Shows a Back button before the brand on phones, for detail pages. */
  onBack?: () => void;
}) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!overHero) return;
    const onScroll = () => setScrolled(window.scrollY > 48);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [overHero]);

  useEffect(() => {
    if (!open) return;
    menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    const onPointer = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!menuRef.current?.contains(target) && !triggerRef.current?.contains(target))
        setOpen(false);
    };
    document.addEventListener('mousedown', onPointer);
    return () => document.removeEventListener('mousedown', onPointer);
  }, [open]);

  function closeMenu() {
    setOpen(false);
    triggerRef.current?.focus();
  }

  function onMenuKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeMenu();
      return;
    }
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    const items = Array.from(
      menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [],
    );
    const index = items.indexOf(document.activeElement as HTMLElement);
    const next =
      event.key === 'ArrowDown'
        ? (index + 1) % items.length
        : (index - 1 + items.length) % items.length;
    event.preventDefault();
    items[next]?.focus();
  }

  // A Kids profile keeps only Switch profile and Exit kids mode (M35-S02).
  const items: MenuItem[] = kids
    ? [
        { label: 'Switch profile', href: switchHref },
        { label: 'Exit kids mode', onSelect: onExitKids },
      ]
    : menu;
  const solid = !overHero || scrolled;

  return (
    <>
      <a className="ad-skip" href="#main">
        Skip to main content
      </a>
      <header
        className="ad-nav"
        data-surface={solid ? 'solid' : 'clear'}
        data-back={onBack ? 'true' : undefined}
      >
        <div className="ad-nav__inner">
          {onBack ? (
            <button type="button" className="ad-nav__back" aria-label="Back" onClick={onBack}>
              <Icon name="back" size={24} />
            </button>
          ) : null}
          <Link href={brand.href} className="ad-nav__brand" aria-label={`${brand.name}, home`}>
            {brand.logoUrl ? (
              <img src={brand.logoUrl} alt="" height={32} />
            ) : (
              <span className="ad-nav__logo" aria-hidden="true">
                <Icon name="play" size={16} filled />
              </span>
            )}
            <span className="ad-nav__name">{brand.name}</span>
          </Link>

          {kids ? null : (
            <nav aria-label="Main" className="ad-nav__links">
              {links.map((link) => {
                const current = isCurrentPath(currentPath, link.href);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="ad-nav__link"
                    aria-current={current ? 'page' : undefined}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </nav>
          )}

          <div className="ad-nav__tools">
            <Link href={searchHref} className="ad-iconbtn" aria-label="Search" data-variant="plain">
              <Icon name="search" size={24} />
            </Link>
            <div className="ad-nav__account">
              <button
                ref={triggerRef}
                type="button"
                className="ad-nav__avatar"
                aria-label={`Profile menu, ${profileName}`}
                aria-haspopup="menu"
                aria-expanded={open}
                onClick={() => setOpen((value) => !value)}
              >
                <Avatar name={profileName} size={32} />
              </button>
              {open ? (
                <div
                  ref={menuRef}
                  className="ad-menu"
                  role="menu"
                  aria-label="Profile menu"
                  onKeyDown={onMenuKeyDown}
                >
                  <p className="ad-menu__head" aria-hidden="true">
                    {profileName}
                  </p>
                  {items.map((item) =>
                    item.href ? (
                      <Link
                        key={item.label}
                        href={item.href}
                        role="menuitem"
                        className="ad-menu__item"
                        onClick={() => setOpen(false)}
                      >
                        {item.label}
                      </Link>
                    ) : (
                      <button
                        key={item.label}
                        type="button"
                        role="menuitem"
                        className="ad-menu__item"
                        onClick={() => {
                          setOpen(false);
                          item.onSelect?.();
                        }}
                      >
                        {item.label}
                      </button>
                    ),
                  )}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </header>
    </>
  );
}

export function BottomTabBar({
  tabs,
  currentPath,
}: {
  tabs: Array<NavLink & { icon: IconName }>;
  currentPath: string;
}) {
  return (
    <nav aria-label="Primary" className="ad-tabbar">
      {tabs.map((tab) => {
        const current = isCurrentPath(currentPath, tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className="ad-tabbar__item"
            aria-current={current ? 'page' : undefined}
          >
            <Icon name={tab.icon} size={24} />
            <span>{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export function SiteFooter({
  platformName,
  year,
  links,
  className,
}: {
  platformName: string;
  year: number;
  links: NavLink[];
  className?: string;
}) {
  return (
    <footer className={cx('ad-footer', className)}>
      <nav aria-label="Footer" className="ad-footer__links">
        {links.map((link) => (
          <Link key={link.href} href={link.href}>
            {link.label}
          </Link>
        ))}
      </nav>
      <p className="ad-footer__note">
        {platformName} {year}
      </p>
    </footer>
  );
}
