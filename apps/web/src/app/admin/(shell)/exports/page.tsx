import type { Metadata } from 'next';
import { forbidden } from 'next/navigation';
import { ExportsView, type ExportNotice } from '@/components/admin/ExportsView';
import { PageHeader } from '@/components/admin/PageHeader';
import { ErrorState } from '@/components/admin/states';
import { can } from '@/lib/admin/can';
import { exportsAdmin } from '@/lib/data/admin/exports';
import { requireActor } from '@/lib/data/admin/session-next';

export const metadata: Metadata = { title: 'Exports' };
export const dynamic = 'force-dynamic';

const NOTICES: readonly string[] = ['asked', 'busy', 'invalid', 'failed'];

export default async function ExportsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const actor = await requireActor('/admin/exports');
  if (!can(actor.role, 'analytics.view') && !can(actor.role, 'audit.export')) forbidden();
  const { notice } = await searchParams;
  const known =
    typeof notice === 'string' && NOTICES.includes(notice) ? (notice as ExportNotice) : undefined;
  const crumbs = [{ label: 'Admin', href: '/admin' }, { label: 'Exports' }];
  try {
    const items = await exportsAdmin.list(actor);
    return (
      <>
        <PageHeader
          crumbs={crumbs}
          title="Exports"
          lead="Large exports are built in the background. You get an email with a link, and only you can open the file."
        />
        <ExportsView items={items} notice={known} />
      </>
    );
  } catch {
    return (
      <>
        <PageHeader crumbs={crumbs} title="Exports" />
        <ErrorState
          title="We could not load your exports."
          help="Nothing was changed. Try again in a moment."
        />
      </>
    );
  }
}
