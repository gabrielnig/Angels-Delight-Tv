import type { ReactNode } from 'react';
import { AppShell } from '../../components/Shell';
import { KidsGate } from '../../components/KidsGate';
import { requireProfile } from '../../lib/session';

const LINKS = [
  { href: '/account', label: 'Overview' },
  { href: '/account/security', label: 'Security' },
  { href: '/settings/playback', label: 'Playback' },
  { href: '/account/data', label: 'Your data' },
];

/** Account pages are for adults. A Kids profile sees the password gate. */
export default async function AccountLayout({ children }: { children: ReactNode }) {
  const { profile } = await requireProfile('/account');
  if (profile.kids) {
    return (
      <AppShell>
        <KidsGate what="Account settings" />
      </AppShell>
    );
  }
  return (
    <AppShell>
      <div className="web-page web-account">
        <nav aria-label="Account" className="web-account__nav">
          <ul>
            {LINKS.map((l) => (
              <li key={l.href}>
                <a href={l.href}>{l.label}</a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="web-account__main">{children}</div>
      </div>
    </AppShell>
  );
}
