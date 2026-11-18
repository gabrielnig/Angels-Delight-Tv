'use client';

import { usePathname } from 'next/navigation';
import { Icon, type IconName } from '@ad/ui';

export const ACCOUNT_LINKS: { href: string; label: string; icon: IconName }[] = [
  { href: '/account', label: 'Overview', icon: 'user' },
  { href: '/account/security', label: 'Security', icon: 'lock' },
  { href: '/settings/playback', label: 'Playback', icon: 'settings' },
  { href: '/account/data', label: 'Your data', icon: 'shield' },
];

/** Side nav on wide screens, a wrapped row on narrow ones. The current page is marked. */
export function AccountNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Account" className="web-account__nav">
      <ul>
        {ACCOUNT_LINKS.map((l) => (
          <li key={l.href}>
            <a href={l.href} aria-current={pathname === l.href ? 'page' : undefined}>
              <Icon name={l.icon} size={20} />
              {l.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
