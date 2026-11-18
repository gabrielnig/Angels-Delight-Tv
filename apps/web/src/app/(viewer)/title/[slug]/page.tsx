import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { formatDuration } from '@ad/ui';
import { AppShell } from '../../../../components/Shell';
import { PublicTitle, TitleBlocked, TitleView } from '../../../../components/title/TitleView';
import { getCatalog, getLibrary } from '../../../../lib/data';
import { previewMetadata } from '../../../../lib/seo';
import { getRootTheme } from '../../../../lib/theme/root';
import { itemKey } from '../../../../lib/format';
import { getSession, requireProfile } from '../../../../lib/session';

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const preview = await getCatalog().publicPreview(slug, 'video');
  if (!preview || preview.type !== 'video') return { title: 'Video not found' };
  const { item } = preview;
  const { platformName } = await getRootTheme();
  return previewMetadata({
    kind: 'video',
    title: item.title,
    description: item.description,
    path: `/title/${item.slug}`,
    siteName: platformName,
    thumbnail: item.thumbnail,
    durationSeconds: item.durationSeconds,
  });
}

export default async function TitlePage({ params }: Params) {
  const { slug } = await params;
  const session = await getSession();
  if (!session) {
    const preview = await getCatalog().publicPreview(slug, 'video');
    if (!preview) notFound();
    if (preview.type === 'redirect') redirect(preview.to);
    if (preview.type !== 'video') notFound();
    const video = preview.item;
    return (
      <AppShell>
        <PublicTitle
          slug={slug}
          thumbnail={video.thumbnail}
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
  if ('redirect' in detail) redirect(detail.redirect);
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
