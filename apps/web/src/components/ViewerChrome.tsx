'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useState, useTransition, type ReactNode } from 'react';
import { BottomTabBar, SiteFooter, TopNav, type MenuItem } from '@ad/ui';
import { signOutAction } from '../app/actions';
import { clearServiceWorkerCaches } from '../lib/pwa/purge';
import { KidsExitDialog } from './KidsExitDialog';

export interface ChromeProps {
  platformName: string;
  logoUrl?: string;
  profileName: string;
  kids: boolean;
  footerLinks: Array<{ label: string; href: string }>;
  year: number;
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

export function ViewerChrome({
  platformName,
  logoUrl,
  profileName,
  kids,
  footerLinks,
  year,
  children,
}: ChromeProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [exitOpen, setExitOpen] = useState(false);
  const [, startTransition] = useTransition();

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
          await signOutAction();
          clearServiceWorkerCaches(navigator);
          router.push('/');
          router.refresh();
        }),
    },
  ];

  return (
    <div className="web-shell" data-kids={kids ? 'true' : undefined}>
      <TopNav
        brand={{ name: platformName, href: '/', logoUrl }}
        links={LINKS}
        currentPath={pathname}
        profileName={profileName}
        menu={menu}
        overHero={pathname === '/'}
        kids={kids}
        onExitKids={() => setExitOpen(true)}
      />
      <main id="main" className="web-main" tabIndex={-1}>
        {children}
      </main>
      <SiteFooter platformName={platformName} year={year} links={footerLinks} />
      <BottomTabBar tabs={TABS} currentPath={pathname} />
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
  );
}
