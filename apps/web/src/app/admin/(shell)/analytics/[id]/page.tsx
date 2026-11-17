import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { NotFound } from '@ad/shared';
import { VideoAnalyticsView } from '@/components/admin/AnalyticsView';
import { PageHeader } from '@/components/admin/PageHeader';
import { ErrorState, NoAccess } from '@/components/admin/states';
import { can } from '@/lib/admin/can';
import { parseRange } from '@/lib/data/admin/analytics-rules';
import { analyticsService } from '@/lib/data/admin/services';
import { ROLE_LABELS } from '@/lib/data/admin/session';
import { requireActor } from '@/lib/data/admin/session-next';

export const metadata: Metadata = { title: 'Video analytics' };
export const dynamic = 'force-dynamic';

export default async function VideoAnalyticsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const actor = await requireActor(`/admin/analytics/${id}`);
  if (!can(actor.role, 'analytics.view'))
    return (
      <NoAccess
        pageName="Analytics"
        roleLabel={ROLE_LABELS[actor.role]}
        needed="editors and admins"
      />
    );
  const { preset, range } = parseRange(await searchParams);
  try {
    const data = await analyticsService.video(actor, id, range);
    return (
      <>
        <PageHeader
          crumbs={[
            { label: 'Admin', href: '/admin' },
            { label: 'Analytics', href: '/admin/analytics' },
            { label: data.title },
          ]}
          title={data.title}
        />
        <VideoAnalyticsView data={data} preset={preset} />
      </>
    );
  } catch (error) {
    if (error instanceof NotFound) notFound();
    return (
      <ErrorState
        title="We could not load analytics for this video."
        help="Nothing was changed. Try again in a moment."
      />
    );
  }
}
