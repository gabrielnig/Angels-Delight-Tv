'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useState, useTransition, type ReactNode } from 'react';
import { BottomTabBar, SiteFooter, TopNav, type MenuItem } from '@ad/ui';
import { signOutAction } from '../app/actions';
import { clearServiceWorkerCaches } from '../lib/pwa/purge';
import { requestSignOut } from '../lib/pwa/sign-out';
import { useSearchShortcut } from './browse/useSearchShortcut';
import { ProfileIdProvider } from '../lib/profile-context';
import { KidsExitDialog } from './KidsExitDialog';
import { GuestIntentApplier } from './guest/GuestIntentApplier';
import { ImportPrompt } from './guest/ImportPrompt';
import { QueueSync } from './pwa/QueueSync';

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
  children: ReactNode;
}

const LINKS = [
  { label: 'Home', href: '/' },
  { label: 'Browse', href: '/browse' },
  { label: 'My List', href: '/my-list' },
];

const SOFT_LINKS = [
  { label: 'Home', href: '/' },
  { label: 'Subjects', href: '/browse' },
  { label: 'New', href: '/browse?sort=newest' },
  { label: 'My List', href: '/my-list' },
];

const TABS = [
  { label: 'Home', href: '/', icon: 'home' as const },
  { label: 'Browse', href: '/browse', icon: 'grid' as const },
  { label: 'Search', href: '/search', icon: 'search' as const },
  { label: 'My List', href: '/my-list', icon: 'list' as const },
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
  children,
}: ChromeProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [exitOpen, setExitOpen] = useState(false);
  const [, startTransition] = useTransition();
  useSearchShortcut(router.push);
  // Title pages have a Back button and their own sticky Play bar instead of the tab bar (S18).
  const detail = pathname.startsWith('/title/');

  const menu: MenuItem[] = [
    { label: 'Switch profile', href: '/profiles?switch=1' },
    { label: 'Manage profiles', href: '/profiles/manage' },
    { label: 'Account', href: '/account' },
    { label: 'Playback settings', href: '/settings/playback' },
    { label: 'Help', href: '/help' },
    {
      label: 'Sign out',
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
          links={skin === 'soft' ? SOFT_LINKS : LINKS}
          currentPath={pathname}
          profileName={profileName}
          profileAvatarId={profileAvatarId}
          menu={menu}
          overHero={pathname === '/'}
          kids={kids}
          skin={skin}
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
        {detail ? null : <BottomTabBar tabs={TABS} currentPath={pathname} />}
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
    </ProfileIdProvider>
  );
}
