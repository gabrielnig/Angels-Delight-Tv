import type { Metadata } from 'next';
import { forbidden } from 'next/navigation';
import { AuditLogView } from '@/components/admin/AuditLogView';
import { PageHeader } from '@/components/admin/PageHeader';
import { LinkButton } from '@/components/admin/Button';
import { ErrorState } from '@/components/admin/states';
import { can } from '@/lib/admin/can';
import { parseAuditQuery } from '@/lib/data/admin/audit-adapter';
import { auditService } from '@/lib/data/admin/services';
import { requireActor } from '@/lib/data/admin/session-next';

export const metadata: Metadata = { title: 'Audit log' };
export const dynamic = 'force-dynamic';

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const actor = await requireActor('/admin/audit-log');
  if (!can(actor.role, 'audit.read')) forbidden();
  const query = parseAuditQuery(await searchParams);
  const crumbs = [{ label: 'Admin', href: '/admin' }, { label: 'Audit log' }];
  try {
    const [page, selected] = await Promise.all([
      auditService.list(actor, query),
      query.entry
        ? auditService.get(actor, Number(query.entry)).catch(() => null)
        : Promise.resolve(null),
    ]);
    return (
      <>
        <PageHeader
          crumbs={crumbs}
          title="Audit log"
          lead="Who did what, and when. Entries cannot be edited or deleted."
        />
        <AuditLogView
          rows={page.items}
          nextCursor={page.nextCursor}
          query={query}
          selected={selected}
        />
      </>
    );
  } catch {
    return (
      <>
        <PageHeader crumbs={crumbs} title="Audit log" />
        <ErrorState
          title="We could not load the audit log."
          help="Nothing was changed. Try again in a moment."
        />
        <LinkButton href="/admin/audit-log" icon="retry">
          Try again
        </LinkButton>
      </>
    );
  }
}
