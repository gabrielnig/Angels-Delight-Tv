'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useTransition, type ReactNode } from 'react';
import { useT } from '../../lib/i18n/provider';
import { BottomTabBar, Button, ButtonLink, Link, SiteFooter, TopNav, type MenuItem } from '@ad/ui';
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
  languagePicker?: ReactNode;
  children: ReactNode;
}

type Msg = ReturnType<typeof useT>;

const links = (msg: Msg) => [
  { label: msg('nav.home'), href: '/' },
  { label: msg('nav.browse'), href: '/browse' },
  { label: msg('nav.myList'), href: '/my-list' },
];

const tabs = (msg: Msg) => [
  { label: msg('nav.home'), href: '/', icon: 'home' as const },
  { label: msg('nav.browse'), href: '/browse', icon: 'grid' as const },
  { label: msg('nav.search'), href: '/search', icon: 'search' as const },
  { label: msg('nav.myList'), href: '/my-list', icon: 'list' as const },
];

/** The header, tab bar and footer a visitor without an account sees (S81). */
export function GuestChrome({
  platformName,
  logoUrl,
  footerLinks,
  year,
  signUpOpen,
  kids = false,
  setKidsMode,
  languagePicker,
  children,
}: GuestChromeProps) {
  const msg = useT();
  const pathname = usePathname();
  const router = useRouter();
  const [pending, start] = useTransition();
  const changeKids = (next: boolean) =>
    start(async () => {
      await setKidsMode?.(next);
      router.refresh();
    });
  const detail = pathname.startsWith('/title/');
  // The player draws its own chrome: no header and no tab bar on /watch (S185).
  const watching = pathname.startsWith('/watch');

  // One account icon holds what the old bar spread over four controls. Kids mode shows only the switch and Help,
  // so a child cannot reach Create account (S183 frame 4).
  const menu: MenuItem[] = [
    ...(kids ? [] : [{ label: msg('nav.signIn'), href: '/sign-in', variant: 'primary' as const }]),
    ...(kids || !signUpOpen ? [] : [{ label: msg('nav.createAccount'), href: '/sign-up' }]),
    ...(setKidsMode
      ? [
          {
            label: kids ? msg('guest.kids.turnOff') : msg('guest.kids.turnOn'),
            onSelect: () => changeKids(!kids),
            switch: {
              checked: kids,
              label: msg('guest.kids.label'),
              help: msg('nav.sheet.kidsHelp'),
            },
          },
        ]
      : []),
    { label: msg('nav.menu.help'), href: '/help' },
  ];
  return (
    <div className="web-shell" data-kids={kids ? 'true' : undefined} data-guest="true">
      {watching ? (
        <a className="ad-skip" href="#main">
          {msg('guest.nav.skip')}
        </a>
      ) : (
        <TopNav
          brand={{ name: platformName, href: '/', logoUrl }}
          skipLabel={msg('guest.nav.skip')}
          mainNavLabel={msg('guest.nav.main')}
          backLabel={msg('nav.back')}
          switchProfileLabel={msg('nav.menu.switchProfile')}
          exitKidsLabel={msg('nav.menu.exitKids')}
          links={links(msg)}
          currentPath={pathname}
          profileName=""
          menu={menu}
          guest
          sheet={{ title: msg('nav.sheet.accountTitle'), closeLabel: msg('nav.sheet.close') }}
          kids={kids}
          kidsLabel={msg('nav.kidsBadge')}
          accountLabel={msg('nav.accountMenu')}
          searchLabel={msg('nav.search')}
          overHero={pathname === '/'}
          trailing={kids ? undefined : languagePicker}
          guestActions={
            kids ? undefined : (
              <>
                <Link href="/sign-in" className="ad-nav__link">
                  {msg('nav.signIn')}
                </Link>
                {signUpOpen ? (
                  <ButtonLink href="/sign-up" size="sm">
                    {msg('nav.createAccount')}
                  </ButtonLink>
                ) : null}
              </>
            )
          }
          onBack={detail ? () => router.back() : undefined}
        />
      )}
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
      {detail || kids || watching ? null : <BottomTabBar tabs={tabs(msg)} currentPath={pathname} />}
    </div>
  );
}
