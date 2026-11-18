'use client';

import { usePathname } from 'next/navigation';
import { SignOutButton } from '../SignOutButton';
import { AcctIcon, type AcctIconName } from './icons';

export const ACCOUNT_LINKS: { href: string; label: string; icon: AcctIconName }[] = [
  { href: '/account', label: 'Overview', icon: 'user' },
  { href: '/account/security', label: 'Security', icon: 'shield' },
  { href: '/settings/playback', label: 'Playback settings', icon: 'play' },
  { href: '/account/data', label: 'Data and privacy', icon: 'download' },
];

/** Side nav with a soft blue current item on wide screens, a single row of pill tabs on narrow ones. */
export function AccountNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Account" className="acct-nav">
      <ul>
        {ACCOUNT_LINKS.map((l) => (
          <li key={l.href}>
            <a href={l.href} aria-current={pathname === l.href ? 'page' : undefined}>
              <AcctIcon name={l.icon} />
              {l.label}
            </a>
          </li>
        ))}
      </ul>
      <div className="acct-nav__rule" aria-hidden="true" />
      <SignOutButton variant="plain" className="acct-nav__out">
        <AcctIcon name="close" />
        Sign out
      </SignOutButton>
    </nav>
  );
}
