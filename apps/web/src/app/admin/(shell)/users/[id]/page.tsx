import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { NotFound } from '@ad/shared';
import { PageHeader } from '@/components/admin/PageHeader';
import { NoAccess } from '@/components/admin/states';
import { UserDetail } from '@/components/admin/UserDetail';
import { can } from '@/lib/admin/can';
import { peopleService } from '@/lib/data/admin/services';
import { ROLE_LABELS } from '@/lib/data/admin/session';
import { requireActor } from '@/lib/data/admin/session-next';
import { reinstateUserAction, revokeSessionsAction, suspendUserAction } from '../actions';

export const metadata: Metadata = { title: 'User' };

export default async function UserPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await requireActor(`/admin/users/${id}`);
  if (!can(actor.role, 'users.view'))
    return <NoAccess pageName="Users" roleLabel={ROLE_LABELS[actor.role]} needed="admins" />;
  const user = await peopleService.user(actor, id).catch((e) => {
    if (e instanceof NotFound) notFound();
    throw e;
  });
  return (
    <>
      <PageHeader
        crumbs={[
          { label: 'Admin', href: '/admin' },
          { label: 'Users', href: '/admin/users' },
          { label: user.email },
        ]}
        title={user.email}
      />
      <UserDetail
        user={user}
        canAct={can(actor.role, 'users.suspend')}
        actions={{
          suspend: suspendUserAction,
          reinstate: reinstateUserAction,
          revokeSessions: revokeSessionsAction,
        }}
      />
    </>
  );
}
