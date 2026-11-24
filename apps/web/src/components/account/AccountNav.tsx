'use client';

import { useT } from '../../lib/i18n/provider';
import { usePathname } from 'next/navigation';
import { SignOutButton } from '../SignOutButton';
import { msg as sharedMsg, type Translate } from '@ad/shared/messages';
import { AcctIcon, type AcctIconName } from './icons';

export function accountLinks(
  msg: Translate,
): { href: string; label: string; icon: AcctIconName }[] {
  return [
    { href: '/account', label: msg('account.nav.overview'), icon: 'user' },
    { href: '/account/security', label: msg('account.nav.security'), icon: 'shield' },
    { href: '/settings/playback', label: msg('account.nav.playback'), icon: 'play' },
    { href: '/account/notifications', label: msg('engage.notify.nav'), icon: 'bell' },
    { href: '/account/activity', label: msg('account.nav.activity'), icon: 'clock' },
    { href: '/account/data', label: msg('account.nav.data'), icon: 'download' },
  ];
}

/** The English list, for callers outside a component. */
export const ACCOUNT_LINKS = accountLinks(sharedMsg);

/** Side nav with a soft blue current item on wide screens, a single row of pill tabs on narrow ones. */
export function AccountNav() {
  const msg = useT();
  const pathname = usePathname();
  return (
    <nav aria-label={msg('account.account')} className="acct-nav">
      <ul>
        {accountLinks(msg).map((l) => (
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
        {msg('account.signOut')}
      </SignOutButton>
    </nav>
  );
}
