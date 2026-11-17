import type { Metadata } from 'next';
import { MyAccountView } from '@/components/admin/MyAccountView';
import { PageHeader } from '@/components/admin/PageHeader';
import { accountService } from '@/lib/data/admin/services';
import { ROLE_LABELS } from '@/lib/data/admin/session';
import { requireActor } from '@/lib/data/admin/session-next';
import {
  changePasswordAction,
  regenerateCodesAction,
  revokeSessionAction,
  updateNameAction,
} from './actions';

export const metadata: Metadata = { title: 'My account' };
export const dynamic = 'force-dynamic';

export default async function AccountPage() {
  const actor = await requireActor('/admin/account');
  const account = await accountService.get(actor);
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
    </>
  );
}
