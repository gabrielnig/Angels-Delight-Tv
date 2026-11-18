import type { ReactNode } from 'react';
import { AppShell } from '../../components/Shell';
import { AccountNav } from '../../components/account/AccountNav';
import { KidsGate } from '../../components/KidsGate';
import { requireProfile } from '../../lib/session';

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
        <AccountNav />
        <div className="web-account__main">{children}</div>
      </div>
    </AppShell>
  );
}
