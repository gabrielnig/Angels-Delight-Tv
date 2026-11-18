import type { Metadata } from 'next';
import { forbidden } from 'next/navigation';
import { PageHeader } from '@/components/admin/PageHeader';
import { RolesInvites } from '@/components/admin/RolesInvites';
import { can } from '@/lib/admin/can';
import { peopleService } from '@/lib/data/admin/services';
import { requireActor } from '@/lib/data/admin/session-next';
import {
  changeRoleAction,
  inviteStaffAction,
  reauthenticateAction,
  resendInviteAction,
  resetTwoFactorAction,
  revokeInviteAction,
} from './actions';

export const metadata: Metadata = { title: 'Roles and invites' };

export default async function RolesPage() {
  const actor = await requireActor('/admin/roles');
  if (!can(actor.role, 'roles.view')) forbidden();
  const { staff, invites } = await peopleService.staff(actor);
  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Admin', href: '/admin' }, { label: 'Roles and invites' }]}
        title="Roles and invites"
        lead="Who can sign in to the admin area, and what they can do."
      />
      <RolesInvites
        staff={staff}
        invites={invites}
        now={Date.now()}
        canManage={can(actor.role, 'roles.change')}
        selfId={actor.accountId}
        actions={{
          invite: inviteStaffAction,
          resend: resendInviteAction,
          revoke: revokeInviteAction,
          changeRole: changeRoleAction,
          reauthenticate: reauthenticateAction,
          resetTwoFactor: resetTwoFactorAction,
        }}
      />
    </>
  );
}
