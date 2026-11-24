'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { msg } from '@ad/shared/messages';
import { BottomTabBar, ButtonLink, Icon, Link, SiteFooter } from '@ad/ui';
import './guest.css';

export interface GuestChromeProps {
  platformName: string;
  logoUrl?: string;
  footerLinks: Array<{ label: string; href: string }>;
  year: number;
  signUpOpen: boolean;
  /** Kids mode on this device: the header shows the logo mark alone (R17). */
  kids?: boolean;
  children: ReactNode;
}

const LINKS = [
  { label: 'Home', href: '/' },
  { label: 'Browse', href: '/browse' },
  { label: 'My List', href: '/my-list' },
];

const TABS = [
  { label: 'Home', href: '/', icon: 'home' as const },
  { label: 'Browse', href: '/browse', icon: 'grid' as const },
  { label: 'Search', href: '/search', icon: 'search' as const },
  { label: 'My List', href: '/my-list', icon: 'list' as const },
];

function isCurrent(path: string, href: string): boolean {
  return href === '/' ? path === '/' : path === href || path.startsWith(`${href}/`);
}

/** The header, tab bar and footer a visitor without an account sees (S81). */
export function GuestChrome({
  platformName,
  logoUrl,
  footerLinks,
  year,
  signUpOpen,
  kids = false,
  children,
}: GuestChromeProps) {
  const pathname = usePathname();
  const detail = pathname.startsWith('/title/');
  return (
    <div className="web-shell" data-kids={kids ? 'true' : undefined} data-guest="true">
      <a className="ad-skip" href="#main">
        {msg('guest.nav.skip')}
      </a>
      <header className="web-guestbar" data-over-hero={pathname === '/' ? 'true' : undefined}>
        <Link
          href="/"
          className="web-brand"
          aria-label={kids ? platformName : `${platformName}, home`}
        >
          <span className="web-brand__logo" aria-hidden="true">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt="" width={36} height={36} />
            ) : (
              <Icon name="play" size={16} filled />
            )}
          </span>
          {kids ? null : <span className="web-brand__name">{platformName}</span>}
        </Link>
        {kids ? null : (
          <>
            <nav aria-label={msg('guest.nav.main')} className="web-guestbar__links">
              {LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="web-guestbar__link"
                  aria-current={isCurrent(pathname, link.href) ? 'page' : undefined}
                >
                  {link.label}
                </Link>
              ))}
              <Link
                href="/search"
                className="web-guestbar__link web-guestbar__search"
                aria-label="Search"
              >
                <Icon name="search" size={22} />
              </Link>
            </nav>
            <div className="web-guestbar__account">
              <Link href="/sign-in" className="web-guestbar__link">
                {msg('guest.save.signIn')}
              </Link>
              {signUpOpen ? (
                <ButtonLink href="/sign-up" size="sm">
                  {msg('guest.save.createAccount')}
                </ButtonLink>
              ) : null}
            </div>
          </>
        )}
      </header>
      <main id="main" className="web-main" tabIndex={-1}>
        {children}
      </main>
      <SiteFooter platformName={platformName} year={year} links={footerLinks} />
      {detail || kids ? null : <BottomTabBar tabs={TABS} currentPath={pathname} />}
    </div>
  );
}
