import type { Metadata } from 'next';
import { forbidden } from 'next/navigation';
import { PageHeader } from '@/components/admin/PageHeader';
import { TrashList } from '@/components/admin/TrashList';
import { can } from '@/lib/admin/can';
import { videoService } from '@/lib/data/admin/services';
import { requireActor } from '@/lib/data/admin/session-next';
import { purgeVideoAction, restoreVideoAction } from '../actions';

export const metadata: Metadata = { title: 'Trash' };

export default async function TrashPage() {
  const actor = await requireActor('/admin/videos/trash');
  if (!can(actor.role, 'video.restore')) forbidden();
  const videos = await videoService.trashed(actor);
  return (
    <>
      <PageHeader
        crumbs={[
          { label: 'Admin', href: '/admin' },
          { label: 'Videos', href: '/admin/videos' },
          { label: 'Trash' },
        ]}
        title="Trash"
        lead="Videos wait here for 30 days before they are deleted for good."
      />
      <TrashList
        videos={videos}
        role={actor.role}
        now={Date.now()}
        restore={restoreVideoAction}
        purge={purgeVideoAction}
      />
    </>
  );
}
