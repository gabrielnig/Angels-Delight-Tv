import type { Metadata } from 'next';
import { forbidden, notFound } from 'next/navigation';
import { NotFound } from '@ad/shared';
import { parseReportRange } from '@ad/sponsors';
import { PageHeader } from '@/components/admin/PageHeader';
import { SponsorReportView } from '@/components/admin/SponsorReportView';
import { can } from '@/lib/admin/can';
import { requireActor } from '@/lib/data/admin/session-next';
import { sponsorReports } from '@/server/sponsors/admin';

export const metadata: Metadata = { title: 'Sponsor report' };

export default async function SponsorReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const actor = await requireActor(`/admin/sponsors/${id}/report`);
  if (!can(actor.role, 'sponsor.manage')) forbidden();
  const { fromDay, toDay } = parseReportRange(query, new Date());
  const view = await sponsorReports(actor)
    .view(actor, id, fromDay, toDay)
    .catch((error: unknown) => {
      if (error instanceof NotFound) notFound();
      throw error;
    });
  return (
    <>
      <PageHeader
        crumbs={[
          { label: 'Admin', href: '/admin' },
          { label: 'Sponsors', href: '/admin/sponsors' },
          { label: view.sponsorName, href: `/admin/sponsors/${id}` },
          { label: 'Report' },
        ]}
        title={`${view.sponsorName} report`}
      />
      <SponsorReportView
        sponsorId={id}
        sponsorName={view.sponsorName}
        report={view.report}
        canExport={can(actor.role, 'sponsor.report.export')}
      />
    </>
  );
}
