import type { Metadata } from 'next';
import { forbidden, notFound, redirect } from 'next/navigation';
import { ExportConfirm } from '@/components/admin/ExportsView';
import { LinkButton } from '@/components/admin/Button';
import { PageHeader } from '@/components/admin/PageHeader';
import { can } from '@/lib/admin/can';
import {
  EXPORT_PERMISSION,
  INLINE_EXPORT_MAX,
  exportName,
  parseExportRequest,
  toQueryString,
} from '@/lib/data/admin/exports-rules';
import { analyticsService, auditService } from '@/lib/data/admin/services';
import { requireActor } from '@/lib/data/admin/session-next';
import { requestExportAction } from '../actions';

export const metadata: Metadata = { title: 'Confirm export' };
export const dynamic = 'force-dynamic';

const OUTCOME = { success: 'Succeeded', failure: 'Failed', denied: 'Denied' } as const;

function summaryOf(kind: 'audit' | 'analytics', params: Record<string, string>): string[] {
  if (kind === 'analytics') return [`From ${params.from} to ${params.to}`];
  const lines: string[] = [];
  if (params.action) lines.push(`Action starts with ${params.action}`);
  if (params.actor) lines.push('One person only');
  if (params.target) lines.push(`Target ${params.target}`);
  if (params.outcome)
    lines.push(`Outcome: ${OUTCOME[params.outcome as keyof typeof OUTCOME] ?? params.outcome}`);
  if (params.from) lines.push(`From ${params.from}`);
  if (params.to) lines.push(`To ${params.to}`);
  return lines.length ? lines : ['Every entry you can see'];
}

/** Opening this page changes nothing. It counts the rows and shows a form; the form post starts the job. */
export default async function NewExportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const actor = await requireActor('/admin/exports');
  const source = await searchParams;
  const request = parseExportRequest(source.kind, source);
  if (!request) notFound();
  if (!can(actor.role, EXPORT_PERMISSION[request.kind])) forbidden();
  const crumbs = [
    { label: 'Admin', href: '/admin' },
    { label: 'Exports', href: '/admin/exports' },
    { label: 'New export' },
  ];
  const rows =
    request.kind === 'audit'
      ? (await auditService.exportPlan(actor, request.params)).rows
      : (
          await analyticsService.exportPlan(actor, {
            from: request.params.from!,
            to: request.params.to!,
          })
        ).rows;
  if (rows <= INLINE_EXPORT_MAX) {
    const path = request.kind === 'audit' ? '/admin/audit-log/export' : '/admin/analytics/export';
    const query = new URLSearchParams(toQueryString(request));
    query.delete('kind');
    redirect(`${path}?${query.toString()}`);
  }
  return (
    <>
      <PageHeader crumbs={crumbs} title={`Export ${exportName(request.kind).toLowerCase()}`} />
      <ExportConfirm
        name={exportName(request.kind)}
        rows={rows}
        summary={summaryOf(request.kind, request.params)}
        fields={{ kind: request.kind, ...request.params }}
        action={requestExportAction}
      />
      <p>
        <LinkButton href="/admin/exports" variant="ghost">
          See my exports
        </LinkButton>
      </p>
    </>
  );
}
