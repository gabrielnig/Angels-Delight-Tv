import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import { formatDuration } from '@ad/ui';
import { setGuestAudienceAction } from '../../../actions';
import { GuestKidsBlocked } from '../../../../components/guest/GuestKidsBlocked';
import { TitleBlocked } from '../../../../components/title/TitleStates';
import { PublicTitle, TitleView } from '../../../../components/title/TitleView';
import { getCatalog, getLibrary } from '../../../../lib/data';
import { JsonLd } from '../../../../components/seo/JsonLd';
import { previewMetadata } from '../../../../lib/seo';
import { titlePageJsonLd } from '../../../../lib/seo/page-jsonld';
import { siteOrigin, titleIndexable } from '../../../../server/seo/page-seo';
import { getRootTheme } from '../../../../lib/theme/root';
import { itemKey } from '../../../../lib/format';
import { getSite } from '../../../../lib/data';
import { getViewerOrGuest } from '../../../../lib/session';
import { guestPlayEnabled } from '../../../../server/guest/guest-settings';

type Params = { params: Promise<{ slug: string }> };

/** An unpublished, removed or unknown title is never indexed (M45-S02, M45-S14). */
const NOT_INDEXED = { index: false, follow: false } as const;

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const preview = await getCatalog().publicPreview(slug, 'video');
  if (!preview || preview.type !== 'video') {
    return { title: 'Video not found', robots: NOT_INDEXED };
  }
  const { item } = preview;
  const [{ platformName }, indexable] = await Promise.all([
    getRootTheme(),
    titleIndexable('video', item.slug),
  ]);
  return previewMetadata({
    kind: 'video',
    title: item.title,
    description: item.description,
    path: `/title/${item.slug}`,
    siteName: platformName,
    thumbnail: item.thumbnail,
    durationSeconds: item.durationSeconds,
    indexable,
    shareImagePath: `/og/title/${encodeURIComponent(item.slug)}?v=${encodeURIComponent(item.publishedAt ?? '')}`,
  });
}

export default async function TitlePage({ params }: Params) {
  const { slug } = await params;
  const viewer = await getViewerOrGuest(`/title/${slug}`);
  // With guest play switched off a visitor sees the preview and a way in (M07-S06).
  if (viewer.kind === 'guest' && !(await guestPlayEnabled())) {
    const preview = await getCatalog().publicPreview(slug, 'video');
    if (!preview) notFound();
    if (preview.type === 'redirect') permanentRedirect(preview.to);
    if (preview.type !== 'video') notFound();
    const video = preview.item;
    return (
      <PublicTitle
        slug={slug}
        thumbnail={video.thumbnail}
        title={video.title}
        description={video.description}
        minutes={formatDuration(video.durationSeconds)}
        category={video.categoryName}
      />
    );
  }
  const { ctx } = viewer;
  const detail = await getCatalog().title(ctx, slug);
  if (!detail) notFound();
  if ('redirect' in detail) permanentRedirect(detail.redirect);
  if ('blocked' in detail) {
    return viewer.kind === 'guest' ? (
      <GuestKidsBlocked setKidsMode={setGuestAudienceAction} />
    ) : (
      <TitleBlocked />
    );
  }
  const [{ platformName }, indexable] = await Promise.all([
    getRootTheme(),
    titleIndexable('video', detail.video.slug),
  ]);
  const structured = indexable ? (
    <JsonLd
      data={titlePageJsonLd({ origin: siteOrigin(), siteName: platformName, video: detail.video })}
    />
  ) : null;
  if (viewer.kind === 'guest') {
    const { signUpOpen } = await getSite().content();
    return (
      <>
        {structured}
        <TitleView detail={detail} inList={false} guest={{ signUpOpen }} />
      </>
    );
  }
  const ids = await getLibrary().myListIds(ctx);
  return (
    <>
      {structured}
      <TitleView detail={detail} inList={ids.includes(itemKey(detail.video))} />
    </>
  );
}
