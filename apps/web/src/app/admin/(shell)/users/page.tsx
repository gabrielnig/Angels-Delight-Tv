import type { Metadata } from 'next';
import { forbidden } from 'next/navigation';
import { PageHeader } from '@/components/admin/PageHeader';
import { UsersTable } from '@/components/admin/UsersTable';
import { can } from '@/lib/admin/can';
import { peopleService } from '@/lib/data/admin/services';
import { requireActor } from '@/lib/data/admin/session-next';

export const metadata: Metadata = { title: 'Users' };

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const actor = await requireActor('/admin/users');
  if (!can(actor.role, 'users.view')) forbidden();
  const sp = await searchParams;
  const q = typeof sp.q === 'string' ? sp.q.slice(0, 100) : '';
  const status = sp.status === 'active' || sp.status === 'suspended' ? sp.status : '';
  const users = await peopleService.users(actor, { q, status });
  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Admin', href: '/admin' }, { label: 'Users' }]}
        title="Users"
        lead="Viewer accounts. Staff are managed under Roles."
      />
      <UsersTable users={users} q={q} status={status} />
    </>
  );
}
