import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/admin/PageHeader';
import { VideoEditor } from '@/components/admin/VideoEditor';
import { adminDataMode, videoService } from '@/lib/data/admin/services';
import { markersAdmin } from '@/lib/data/admin/markers';
import { markersSummary } from '@/lib/admin/markers-summary';
import { captionsDefaultAvailable } from '@/lib/data/admin/site-settings';
import { requireActor } from '@/lib/data/admin/session-next';
import { NotFound } from '@ad/shared';
import {
  publishVideoAction,
  retryEncodeVideoAction,
  retryPreviewAction,
  setPreviewModeAction,
  setCaptionsAction,
  trashVideoAction,
  unpublishVideoAction,
  updateVideoAction,
} from './actions';

export const metadata: Metadata = { title: 'Edit video' };

/** Real data previews on the staff only preview page (M16-S08). Fixtures have no streams, so they keep the viewer page. */
const viewerHref = (id: string) =>
  adminDataMode() === 'real' ? `/admin/videos/${id}/preview` : `/watch/${id}`;

export default async function VideoEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await requireActor(`/admin/videos/${id}`);
  const video = await videoService.get(actor, id).catch((error) => {
    if (error instanceof NotFound) notFound();
    throw error;
  });
  const [categories, series, extras, captionsDefault] = await Promise.all([
    videoService.categories(actor),
    videoService.seriesOptions(actor),
    markersAdmin.get(actor, id).catch(() => null),
    captionsDefaultAvailable(actor),
  ]);
  return (
    <>
      <PageHeader
        crumbs={[
          { label: 'Admin', href: '/admin' },
          { label: 'Videos', href: '/admin/videos' },
          { label: video.title },
        ]}
        title={video.title}
      />
      <VideoEditor
        key={video.updatedAt}
        video={video}
        categories={categories}
        series={series}
        role={actor.role}
        captionsDefault={captionsDefault}
        viewerHref={viewerHref(id)}
        markersSummary={extras ? markersSummary(extras.markers, extras.chapters) : null}
        actions={{
          update: updateVideoAction.bind(null, id),
          publish: publishVideoAction.bind(null, id),
          unpublish: unpublishVideoAction.bind(null, id),
          retryEncode: retryEncodeVideoAction.bind(null, id),
          bulk: trashVideoAction.bind(null, id),
          setCaptions: setCaptionsAction.bind(null, id),
          setPreviewMode: setPreviewModeAction.bind(null, id),
          retryPreview: retryPreviewAction.bind(null, id),
        }}
      />
    </>
  );
}
