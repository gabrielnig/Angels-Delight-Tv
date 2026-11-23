import type { Metadata } from 'next';
import { Banner } from '@/components/admin/states';
import { EMAIL_NOT_CONFIGURED_WARNING, emailNotConfigured } from '@/lib/admin/email-status';
import { DashboardView } from '@/components/admin/DashboardView';
import { dashboardService } from '@/lib/data/admin/services';
import { requireActor } from '@/lib/data/admin/session-next';

export const metadata: Metadata = { title: 'Dashboard' };

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ simulate?: string }>;
}) {
  const actor = await requireActor('/admin');
  const { simulate } = await searchParams;
  // Fixture build only: ?simulate=processing,views shows the per tile error state.
  const failTiles =
    process.env.NODE_ENV !== 'production' && simulate ? simulate.split(',') : undefined;
  const data = await dashboardService.get(actor, { failTiles });
  const hour = Number(
    new Intl.DateTimeFormat('en-GB', {
      hour: '2-digit',
      hour12: false,
      timeZone: 'Africa/Lagos',
    }).format(new Date()),
  );
  return (
    <>
      {emailNotConfigured() ? <Banner tone="warning">{EMAIL_NOT_CONFIGURED_WARNING}</Banner> : null}
      <DashboardView data={data} name={actor.name} hour={hour} />
    </>
  );
}
