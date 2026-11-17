import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { NotFound } from '@ad/shared';
import { PageHeader } from '@/components/admin/PageHeader';
import { SeriesEditor } from '@/components/admin/SeriesEditor';
import { NoAccess } from '@/components/admin/states';
import { can } from '@/lib/admin/can';
import { collectionService } from '@/lib/data/admin/services';
import { ROLE_LABELS } from '@/lib/data/admin/session';
import { requireActor } from '@/lib/data/admin/session-next';
import { deleteSeriesAction, setEpisodeAction, updateSeriesAction } from '../actions';

export const metadata: Metadata = { title: 'Edit series' };

export default async function SeriesEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await requireActor(`/admin/series/${id}`);
  if (!can(actor.role, 'series.manage'))
    return (
      <NoAccess pageName="Series" roleLabel={ROLE_LABELS[actor.role]} needed="editors and admins" />
    );
  const detail = await collectionService.seriesDetail(actor, id).catch((error) => {
    if (error instanceof NotFound) notFound();
    throw error;
  });
  return (
    <>
      <PageHeader
        crumbs={[
          { label: 'Admin', href: '/admin' },
          { label: 'Series', href: '/admin/series' },
          { label: detail.series.title },
        ]}
        title={detail.series.title}
      />
      <SeriesEditor
        detail={detail}
        canManage
        actions={{
          update: updateSeriesAction,
          remove: deleteSeriesAction,
          setEpisode: setEpisodeAction,
        }}
      />
    </>
  );
}
