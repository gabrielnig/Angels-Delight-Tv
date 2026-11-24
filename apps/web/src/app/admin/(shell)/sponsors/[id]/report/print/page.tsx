import type { Metadata } from 'next';
import { forbidden, notFound } from 'next/navigation';
import { NotFound } from '@ad/shared';
import { parseReportRange } from '@ad/sponsors';
import { SponsorPrintReport } from '@/components/admin/SponsorReportView';
import { can } from '@/lib/admin/can';
import { requireActor } from '@/lib/data/admin/session-next';
import { sponsorReports } from '@/server/sponsors/admin';

export const metadata: Metadata = { title: 'Print sponsor report', robots: { index: false } };

export default async function SponsorReportPrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const actor = await requireActor(`/admin/sponsors/${id}/report/print`);
  if (!can(actor.role, 'sponsor.manage')) forbidden();
  const now = new Date();
  const { fromDay, toDay } = parseReportRange(query, now);
  const view = await sponsorReports(actor)
    .view(actor, id, fromDay, toDay)
    .catch((error: unknown) => {
      if (error instanceof NotFound) notFound();
      throw error;
    });
  return <SponsorPrintReport sponsorName={view.sponsorName} report={view.report} generatedOn={now.toISOString().slice(0, 10)} />;
}
