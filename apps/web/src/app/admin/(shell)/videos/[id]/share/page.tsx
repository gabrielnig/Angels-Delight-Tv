import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { NotFound } from '@ad/shared';
import { PageHeader } from '@/components/admin/PageHeader';
import { ShareCardEditor } from '@/components/admin/ShareCardEditor';
import '@/components/admin/site/site.css';
import { adminDataMode, videoService } from '@/lib/data/admin/services';
import { shareAdmin } from '@/lib/data/admin/real/share';
import { requireActor } from '@/lib/data/admin/session-next';
import { getRootTheme } from '@/lib/theme/root';
import { siteOrigin } from '@/server/seo/page-seo';
import { saveShareTextAction } from '../../../share/actions';

export const metadata: Metadata = { title: 'Share card' };

export default async function VideoSharePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await requireActor(`/admin/videos/${id}/share`);
  const video = await videoService.get(actor, id).catch((error) => {
    if (error instanceof NotFound) notFound();
    throw error;
  });
  const [{ platformName }, initial] = await Promise.all([
    getRootTheme(),
    adminDataMode() === 'real' ? shareAdmin.get(actor, 'video', id) : { title: null, description: null },
  ]);
  return (
    <>
      <PageHeader
        crumbs={[
          { label: 'Admin', href: '/admin' },
          { label: 'Videos', href: '/admin/videos' },
          { label: video.title, href: `/admin/videos/${id}` },
          { label: 'Share card' },
        ]}
        title="Share card"
        lead={video.title}
      />
      <ShareCardEditor
        title={video.title}
        description={video.description}
        siteName={platformName}
        origin={siteOrigin()}
        imageUrl={video.publishState === 'published' ? `/og/title/${encodeURIComponent(video.slug)}` : null}
        initial={initial}
        save={saveShareTextAction.bind(null, 'video', id)}
      />
    </>
  );
}
