import type { ReactNode } from 'react';
import { AppShell } from '../../components/Shell';
import { AccountSupportProvider } from '../../components/account/AccountSupport';
import { getSite } from '../../lib/data';
import { requireProfile } from '../../lib/session';

/**
 * Account screens share the soft header and the account frame. Each page draws the frame itself, because a Kids
 * profile sees the adults only card without the side nav (S27 state 4) and can still open playback settings (S29 state 3).
 */
export default async function AccountLayout({ children }: { children: ReactNode }) {
  await requireProfile('/account');
  const site = await getSite().content();
  return (
    <AppShell skin="soft">
      <AccountSupportProvider email={site.supportEmail}>{children}</AccountSupportProvider>
    </AppShell>
  );
}
