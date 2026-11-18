import type { Metadata } from 'next';
import { MyAccountView } from '@/components/admin/MyAccountView';
import { PageHeader } from '@/components/admin/PageHeader';
import { accountService } from '@/lib/data/admin/services';
import { noticesAdmin } from '@/lib/data/admin/notices';
import { NotificationPrefsCard } from '@/components/admin/NotificationPrefsCard';
import { ROLE_LABELS } from '@/lib/data/admin/session';
import { requireActor } from '@/lib/data/admin/session-next';
import {
  changePasswordAction,
  regenerateCodesAction,
  revokeSessionAction,
  saveNotificationPrefsAction,
  updateNameAction,
} from './actions';

export const metadata: Metadata = { title: 'My account' };
export const dynamic = 'force-dynamic';

export default async function AccountPage() {
  const actor = await requireActor('/admin/account');
  const account = await accountService.get(actor);
  const prefs = await noticesAdmin.prefs(actor);
  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Admin', href: '/admin' }, { label: 'My account' }]}
        title="My account"
      />
      <MyAccountView
        account={account}
        roleLabel={ROLE_LABELS[actor.role]}
        now={Date.now()}
        actions={{
          updateName: updateNameAction,
          changePassword: changePasswordAction,
          revokeSession: revokeSessionAction,
          regenerateCodes: regenerateCodesAction,
        }}
      />
      <NotificationPrefsCard prefs={prefs} save={saveNotificationPrefsAction} />
    </>
  );
}
