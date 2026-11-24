'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition, type ReactNode } from 'react';
import { msg } from '@ad/shared/messages';
import { BottomTabBar, Button, ButtonLink, Icon, Link, SiteFooter } from '@ad/ui';
import './guest.css';

export interface GuestChromeProps {
  platformName: string;
  logoUrl?: string;
  footerLinks: Array<{ label: string; href: string }>;
  year: number;
  signUpOpen: boolean;
  /** Kids mode on this device: the header shows the logo mark alone (R17). */
  kids?: boolean;
  /** Remembers the Kids mode choice of this device. Missing means the switch is not offered. */
  setKidsMode?: (kids: boolean) => Promise<void>;
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
  setKidsMode,
  children,
}: GuestChromeProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [pending, start] = useTransition();
  const menuButton = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setMenuOpen(false);
      menuButton.current?.focus();
    };
    const onPointer = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!menu.current?.contains(target) && !menuButton.current?.contains(target))
        setMenuOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onPointer);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onPointer);
    };
  }, [menuOpen]);
  const changeKids = (next: boolean) =>
    start(async () => {
      await setKidsMode?.(next);
      setMenuOpen(false);
      router.refresh();
    });
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
              {setKidsMode ? (
                <div className="web-guestbar__menuwrap">
                  <button
                    ref={menuButton}
                    type="button"
                    className="web-guestbar__link"
                    aria-haspopup="true"
                    aria-expanded={menuOpen}
                    onClick={() => setMenuOpen((open) => !open)}
                  >
                    {msg('guest.menu')}
                  </button>
                  {menuOpen ? (
                    <div ref={menu} className="web-guestbar__menu">
                      <button
                        type="button"
                        role="switch"
                        aria-checked={kids}
                        className="web-guestbar__switch"
                        disabled={pending}
                        onClick={() => changeKids(!kids)}
                      >
                        {msg('guest.kids.label')}
                      </button>
                      <p className="web-guestbar__help">{msg('guest.kids.help')}</p>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </>
        )}
      </header>
      <main id="main" className="web-main" tabIndex={-1}>
        {children}
      </main>
      {kids && setKidsMode ? (
        <div className="web-guestbar__kidsoff">
          <Button variant="ghost" size="sm" loading={pending} onClick={() => changeKids(false)}>
            {msg('guest.kids.turnOff')}
          </Button>
        </div>
      ) : null}
      <SiteFooter platformName={platformName} year={year} links={footerLinks} />
      {detail || kids ? null : <BottomTabBar tabs={TABS} currentPath={pathname} />}
    </div>
  );
}
