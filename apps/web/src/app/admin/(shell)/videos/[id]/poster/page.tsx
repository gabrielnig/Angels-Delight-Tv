import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { NotFound } from '@ad/shared';
import { PageHeader } from '@/components/admin/PageHeader';
import { PosterPicker } from '@/components/admin/PosterPicker';
import { videoService } from '@/lib/data/admin/services';
import { requireActor } from '@/lib/data/admin/session-next';
import { setPosterAction } from '../actions';

export const metadata: Metadata = { title: 'Choose a poster' };

export default async function PosterPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await requireActor(`/admin/videos/${id}/poster`);
  const video = await videoService.get(actor, id).catch((error) => {
    if (error instanceof NotFound) notFound();
    throw error;
  });
  return (
    <>
      <PageHeader
        crumbs={[
          { label: 'Admin', href: '/admin' },
          { label: 'Videos', href: '/admin/videos' },
          { label: video.title, href: `/admin/videos/${id}` },
          { label: 'Poster' },
        ]}
        title="Choose a poster"
        lead={video.title}
      />
      <PosterPicker
        videoId={id}
        title={video.title}
        durationSeconds={video.durationSeconds}
        initial={{ posterId: video.posterId, alt: video.posterAlt, focus: video.posterFocus }}
        save={setPosterAction.bind(null, id)}
      />
    </>
  );
}
