import type { Metadata } from 'next';
import { forbidden } from 'next/navigation';
import { PageHeader } from '@/components/admin/PageHeader';
import { SeriesList } from '@/components/admin/SeriesList';
import { can } from '@/lib/admin/can';
import { collectionService } from '@/lib/data/admin/services';
import { requireActor } from '@/lib/data/admin/session-next';
import { createSeriesAction } from './actions';

export const metadata: Metadata = { title: 'Series' };

export default async function SeriesPage() {
  const actor = await requireActor('/admin/series');
  if (!can(actor.role, 'series.manage')) forbidden();
  const series = await collectionService.seriesList(actor);
  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Admin', href: '/admin' }, { label: 'Series' }]}
        title="Series"
        lead="Group episodes into seasons."
      />
      <SeriesList series={series} canManage create={createSeriesAction} />
    </>
  );
}
