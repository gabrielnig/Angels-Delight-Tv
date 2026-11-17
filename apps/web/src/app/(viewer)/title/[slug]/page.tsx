import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { formatDuration } from '@ad/ui';
import { AppShell } from '../../../../components/Shell';
import { PublicTitle, TitleBlocked, TitleView } from '../../../../components/title/TitleView';
import { getCatalog, getLibrary } from '../../../../lib/data';
import { itemKey } from '../../../../lib/format';
import { getSession, requireProfile } from '../../../../lib/session';

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const video = await getCatalog().publicTitle(slug);
  if (!video) return { title: 'Video not found' };
  return {
    title: video.title,
    description: video.description,
    openGraph: {
      title: video.title,
      description: video.description,
      type: 'video.other',
      images: video.thumbnail ? [video.thumbnail.src] : undefined,
    },
  };
}

export default async function TitlePage({ params }: Params) {
  const { slug } = await params;
  const session = await getSession();
  if (!session) {
    const video = await getCatalog().publicTitle(slug);
    if (!video) notFound();
    return (
      <AppShell>
        <PublicTitle
          title={video.title}
          description={video.description}
          minutes={formatDuration(video.durationSeconds)}
          category={video.categoryName}
        />
      </AppShell>
    );
  }
  const { ctx } = await requireProfile(`/title/${slug}`);
  const detail = await getCatalog().title(ctx, slug);
  if (!detail) notFound();
  if ('blocked' in detail) {
    return (
      <AppShell>
        <TitleBlocked />
      </AppShell>
    );
  }
  const ids = await getLibrary().myListIds(ctx);
  return (
    <AppShell>
      <TitleView detail={detail} inList={ids.includes(itemKey(detail.video))} />
    </AppShell>
  );
}
