'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useState, useTransition, type ReactNode } from 'react';
import { BottomTabBar, SiteFooter, TopNav, type MenuItem } from '@ad/ui';
import { signOutAction } from '../app/actions';
import { clearServiceWorkerCaches } from '../lib/pwa/purge';
import { requestSignOut } from '../lib/pwa/sign-out';
import { useSearchShortcut } from './browse/useSearchShortcut';
import { useT } from '../lib/i18n/provider';
import { ProfileIdProvider, ProfileKidsProvider } from '../lib/profile-context';
import { KidsExitDialog } from './KidsExitDialog';
import { GuestIntentApplier } from './guest/GuestIntentApplier';
import { ImportPrompt } from './guest/ImportPrompt';
import { QueueSync } from './pwa/QueueSync';
import { ViewerBell } from './notices/ViewerBell';

export interface ChromeProps {
  platformName: string;
  logoUrl?: string;
  profileName: string;
  profileAvatarId?: string;
  profileId: string;
  kids: boolean;
  footerLinks: Array<{ label: string; href: string }>;
  year: number;
  /** `soft` is the S27 to S31 header: page colour, Subjects and New links, name beside the avatar, support address in the footer. */
  skin?: 'soft';
  supportEmail?: string;
  /** The language picker, drawn by the server shell when two or more languages are enabled. */
  languagePicker?: ReactNode;
  children: ReactNode;
}

type Msg = ReturnType<typeof useT>;

const links = (msg: Msg) => [
  { label: msg('nav.home'), href: '/' },
  { label: msg('nav.browse'), href: '/browse' },
  { label: msg('nav.myList'), href: '/my-list' },
];

const softLinks = (msg: Msg) => [
  { label: msg('nav.home'), href: '/' },
  { label: msg('nav.subjects'), href: '/browse' },
  { label: msg('nav.new'), href: '/browse?sort=newest' },
  { label: msg('nav.myList'), href: '/my-list' },
];

const tabs = (msg: Msg) => [
  { label: msg('nav.home'), href: '/', icon: 'home' as const },
  { label: msg('nav.browse'), href: '/browse', icon: 'grid' as const },
  { label: msg('nav.search'), href: '/search', icon: 'search' as const },
  { label: msg('nav.myList'), href: '/my-list', icon: 'list' as const },
];

export function ViewerChrome({
  platformName,
  logoUrl,
  profileName,
  profileAvatarId,
  profileId,
  kids,
  footerLinks,
  year,
  skin,
  supportEmail,
  languagePicker,
  children,
}: ChromeProps) {
  const msg = useT();
  const pathname = usePathname();
  const router = useRouter();
  const [exitOpen, setExitOpen] = useState(false);
  const [, startTransition] = useTransition();
  useSearchShortcut(router.push);
  // Title pages have a Back button and their own sticky Play bar instead of the tab bar (S18).
  const detail = pathname.startsWith('/title/');

  const menu: MenuItem[] = [
    { label: msg('nav.menu.switchProfile'), href: '/profiles?switch=1' },
    { label: msg('nav.menu.manageProfiles'), href: '/profiles/manage' },
    { label: msg('nav.menu.account'), href: '/account' },
    { label: msg('nav.menu.playback'), href: '/settings/playback' },
    { label: msg('nav.menu.help'), href: '/help' },
    {
      label: msg('nav.menu.signOut'),
      onSelect: () =>
        startTransition(async () => {
          await requestSignOut({
            store: localStorage,
            online: () => navigator.onLine,
            signOut: signOutAction,
            clearCaches: () => clearServiceWorkerCaches(navigator),
          });
          router.push('/');
          router.refresh();
        }),
    },
  ];

  return (
    <ProfileIdProvider id={profileId}>
      <ProfileKidsProvider kids={kids}>
        <QueueSync profileId={profileId} />
        <GuestIntentApplier />
        <ImportPrompt profileId={profileId} kids={kids} />
        <div
          className="web-shell"
          data-kids={kids ? 'true' : undefined}
          data-skin={skin === 'soft' ? 'soft' : undefined}
        >
          <TopNav
            brand={{ name: platformName, href: '/', logoUrl }}
            links={skin === 'soft' ? softLinks(msg) : links(msg)}
            currentPath={pathname}
            profileName={profileName}
            profileAvatarId={profileAvatarId}
            menu={menu}
            overHero={pathname === '/'}
            kids={kids}
            skin={skin}
            trailing={
              kids ? undefined : (
                <>
                  {languagePicker}
                  <ViewerBell profileId={profileId} />
                </>
              )
            }
            onExitKids={() => setExitOpen(true)}
            onBack={detail ? () => router.back() : undefined}
          />
          <main id="main" className="web-main" tabIndex={-1}>
            {children}
          </main>
          <SiteFooter
            platformName={platformName}
            year={year}
            links={footerLinks}
            supportEmail={skin === 'soft' ? supportEmail : undefined}
          />
          {detail ? null : <BottomTabBar tabs={tabs(msg)} currentPath={pathname} />}
          {kids ? (
            <KidsExitDialog
              open={exitOpen}
              onClose={() => setExitOpen(false)}
              onUnlocked={() => {
                setExitOpen(false);
                router.push('/profiles');
                router.refresh();
              }}
            />
          ) : null}
        </div>
      </ProfileKidsProvider>
    </ProfileIdProvider>
  );
}
