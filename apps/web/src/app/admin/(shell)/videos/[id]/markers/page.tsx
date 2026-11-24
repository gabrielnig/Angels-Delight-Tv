import '@ad/player/player.css';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { DrizzlePlaybackStore } from '@ad/video';
import { NotFound } from '@ad/shared';
import { MarkerEditorScreen } from '@/components/admin/MarkerEditorScreen';
import { PageHeader } from '@/components/admin/PageHeader';
import { previewCaptionTracks } from '@/lib/admin/preview-captions';
import { markersAdmin } from '@/lib/data/admin/markers';
import { adminDataMode, videoService } from '@/lib/data/admin/services';
import { requireActor } from '@/lib/data/admin/session-next';
import { adminRuntime } from '@/server/admin/runtime';
import { viewerRuntime } from '@/server/viewer/runtime';
import { saveMarkersAction } from './actions';

export const metadata: Metadata = { title: 'Skip and chapters' };
export const dynamic = 'force-dynamic';

/** M43-S04 and S06. Editors set the intro, recap and credits windows and the chapters of one video. */
export default async function MarkersPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await requireActor(`/admin/videos/${id}/markers`);
  const video = await videoService.get(actor, id).catch((error) => {
    if (error instanceof NotFound) notFound();
    throw error;
  });
  const [snapshot, siblings, captions] = await Promise.all([
    markersAdmin.get(actor, id),
    markersAdmin.siblings(actor, id),
    adminDataMode() === 'real'
      ? previewCaptionTracks(
          new DrizzlePlaybackStore(adminRuntime().db()),
          viewerRuntime().ctx.mediaOrigin,
          id,
        )
      : Promise.resolve([]),
  ]);
  return (
    <>
      <PageHeader
        crumbs={[
          { label: 'Admin', href: '/admin' },
          { label: 'Videos', href: '/admin/videos' },
          { label: video.title, href: `/admin/videos/${id}` },
          { label: 'Skip and chapters' },
        ]}
        title="Skip and chapters"
      />
      <MarkerEditorScreen
        key={video.updatedAt}
        video={{ id: video.id, title: video.title, durationSeconds: video.durationSeconds }}
        initial={{ markers: snapshot.markers, chapters: snapshot.chapters }}
        siblings={siblings}
        save={saveMarkersAction.bind(null, id)}
        captions={captions}
        backHref={`/admin/videos/${id}`}
      />
    </>
  );
}
