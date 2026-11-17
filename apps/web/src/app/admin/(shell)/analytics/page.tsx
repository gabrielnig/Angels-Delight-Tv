import type { Metadata } from 'next';
import { AnalyticsOverviewView } from '@/components/admin/AnalyticsView';
import { PageHeader } from '@/components/admin/PageHeader';
import { ErrorState, NoAccess } from '@/components/admin/states';
import { can } from '@/lib/admin/can';
import { parseRange } from '@/lib/data/admin/analytics-rules';
import { analyticsService } from '@/lib/data/admin/services';
import { ROLE_LABELS } from '@/lib/data/admin/session';
import { requireActor } from '@/lib/data/admin/session-next';

export const metadata: Metadata = { title: 'Analytics' };
export const dynamic = 'force-dynamic';

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const actor = await requireActor('/admin/analytics');
  if (!can(actor.role, 'analytics.view'))
    return (
      <NoAccess
        pageName="Analytics"
        roleLabel={ROLE_LABELS[actor.role]}
        needed="editors and admins"
      />
    );
  const sp = await searchParams;
  const { preset, range } = parseRange(sp);
  const crumbs = [{ label: 'Admin', href: '/admin' }, { label: 'Analytics' }];
  try {
    const data = await analyticsService.overview(actor, range);
    const exportHref = `/admin/analytics/export?from=${range.from}&to=${range.to}`;
    return (
      <>
        <PageHeader
          crumbs={crumbs}
          title="Analytics"
          lead="How people use the site. Days follow Lagos time."
        />
        <AnalyticsOverviewView data={data} preset={preset} exportHref={exportHref} />
      </>
    );
  } catch {
    return (
      <>
        <PageHeader crumbs={crumbs} title="Analytics" />
        <ErrorState
          title="We could not load analytics."
          help="Nothing was changed. Try again in a moment."
        />
      </>
    );
  }
}
