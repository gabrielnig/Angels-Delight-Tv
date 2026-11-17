import '@ad/player/player.css';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { DrizzlePlaybackStore } from '@ad/video';
import { NotFound } from '@ad/shared';
import { PageHeader } from '@/components/admin/PageHeader';
import { PreviewPlayer } from '@/components/admin/PreviewPlayer';
import { previewCaptionTracks } from '@/lib/admin/preview-captions';
import { adminDataMode, videoService } from '@/lib/data/admin/services';
import { requireActor } from '@/lib/data/admin/session-next';
import { adminRuntime } from '@/server/admin/runtime';
import { viewerRuntime } from '@/server/viewer/runtime';

export const metadata: Metadata = { title: 'Preview as viewer' };
export const dynamic = 'force-dynamic';

/**
 * M16-S08. Lives under /admin, so a signed out person or a viewer never reaches it, and the preview session
 * route behind the player answers staff only. A shared link therefore fails for anyone else.
 */
export default async function PreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await requireActor(`/admin/videos/${id}/preview`);
  const video = await videoService.get(actor, id).catch((error) => {
    if (error instanceof NotFound) notFound();
    throw error;
  });
  const captions =
    adminDataMode() === 'real'
      ? await previewCaptionTracks(
          new DrizzlePlaybackStore(adminRuntime().db()),
          viewerRuntime().ctx.mediaOrigin,
          id,
        )
      : [];
  return (
    <>
      <PageHeader
        crumbs={[
          { label: 'Admin', href: '/admin' },
          { label: 'Videos', href: '/admin/videos' },
          { label: video.title, href: `/admin/videos/${id}` },
          { label: 'Preview' },
        ]}
        title={`Preview: ${video.title}`}
      />
      <PreviewPlayer
        video={{
          id: video.id,
          title: video.title,
          durationSeconds: video.durationSeconds,
          posterUrl: null,
        }}
        captions={captions}
        backHref={`/admin/videos/${id}`}
      />
    </>
  );
}
