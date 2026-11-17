import type { Metadata } from 'next';
import { forbidden } from 'next/navigation';
import { PageHeader } from '@/components/admin/PageHeader';
import { ErrorState } from '@/components/admin/states';
import { SystemView } from '@/components/admin/SystemView';
import { can } from '@/lib/admin/can';
import { systemService } from '@/lib/data/admin/services';
import { requireActor } from '@/lib/data/admin/session-next';
import { discardJobAction, retryJobAction } from './actions';

export const metadata: Metadata = { title: 'System' };
export const dynamic = 'force-dynamic';

export default async function SystemPage() {
  const actor = await requireActor('/admin/system');
  if (!can(actor.role, 'system.view')) forbidden();
  const crumbs = [{ label: 'Admin', href: '/admin' }, { label: 'System' }];
  try {
    const [jobs, storage, quality] = await Promise.all([
      systemService.jobs(actor),
      systemService.storage(actor),
      systemService.quality(actor),
    ]);
    return (
      <>
        <PageHeader
          crumbs={crumbs}
          title="System"
          lead="Background jobs, storage and how playback is doing."
        />
        <SystemView
          jobs={jobs}
          storage={storage}
          quality={quality}
          now={Date.now()}
          canAct
          actions={{ retry: retryJobAction, discard: discardJobAction }}
        />
      </>
    );
  } catch {
    return (
      <>
        <PageHeader crumbs={crumbs} title="System" />
        <ErrorState
          title="We could not load the system screen."
          help="Nothing was changed. Try again in a moment."
        />
      </>
    );
  }
}
