import { sponsorFor } from '../../../../server/sponsors/surface-runtime';
import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import { formatDuration } from '@ad/ui';
import { setGuestAudienceAction } from '../../../actions';
import { GuestKidsBlocked } from '../../../../components/guest/GuestKidsBlocked';
import { TitleBlocked } from '../../../../components/title/TitleStates';
import { PublicTitle, TitleView } from '../../../../components/title/TitleView';
import { getCatalog, getLibrary } from '../../../../lib/data';
import { JsonLd } from '../../../../components/seo/JsonLd';
import { pageMetadata, shareImageExtra } from '../../../../server/seo/site-meta';
import { shareOf, shareTextOf } from '../../../../lib/seo/share-overrides';
import { shareImageFor } from '../../../../lib/seo/share-image';
import { titlePageJsonLd } from '../../../../lib/seo/page-jsonld';
import { shareConfig, siteOrigin, titleIndexable } from '../../../../server/seo/page-seo';
import { parseStartAt } from '../../../../features/player/start-at';
import { getRootTheme } from '../../../../lib/theme/root';
import { itemKey } from '../../../../lib/format';
import { getSite } from '../../../../lib/data';
import { getViewerOrGuest } from '../../../../lib/session';
import { guestPlayEnabled } from '../../../../server/guest/guest-settings';

type Params = { params: Promise<{ slug: string }> };
type PageProps = Params & { searchParams?: Promise<{ t?: string | string[] }> };

/** An unpublished, removed or unknown title is never indexed (M45-S02, M45-S14). */
const NOT_INDEXED = { index: false, follow: false } as const;

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const preview = await getCatalog().publicPreview(slug, 'video');
  if (!preview || preview.type !== 'video') {
    return { title: 'Video not found', robots: NOT_INDEXED };
  }
  const { item } = preview;
  const path = `/title/${item.slug}`;
  const words = shareTextOf(item, preview.share);
  const indexable = await titleIndexable('video', item.slug);
  // Kids only titles (and a failed lookup) show the generic platform card: no title, text or picture (R26).
  if (!indexable) return pageMetadata({ kind: 'private', path });
  return pageMetadata({
    kind: 'video',
    path,
    title: words.title,
    description: words.description,
    image: shareImageFor('title', item.slug, words.title, item.publishedAt, item.thumbnail, await shareImageExtra()),
    durationSeconds: item.durationSeconds,
    releasedAt: item.publishedAt || undefined,
    tags: item.categoryName ? [item.categoryName] : undefined,
  });
}

export default async function TitlePage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const startAt = parseStartAt((await searchParams)?.t);
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
  const [{ platformName }, indexable, share] = await Promise.all([
    getRootTheme(),
    titleIndexable('video', detail.video.slug),
    shareConfig(detail.video.title, 'video', detail.video.slug, detail.video.thumbnail?.src),
  ]);
  const kids = ctx.audience === 'kids';
  const sponsor = kids ? null : await sponsorFor('title_card', ctx);
  const words = shareTextOf(
    detail.video,
    shareOf(await getCatalog().publicPreview(detail.video.slug, 'video')),
  );
  const shareImage = shareImageFor(
    'title',
    detail.video.slug,
    words.title,
    detail.video.publishedAt,
    detail.video.thumbnail,
    await shareImageExtra(),
  ).url;
  const structured = indexable ? (
    <JsonLd
      data={titlePageJsonLd({
        origin: siteOrigin(),
        siteName: platformName,
        video: detail.video,
        shareImage,
        words,
      })}
    />
  ) : null;
  if (viewer.kind === 'guest') {
    const { signUpOpen } = await getSite().content();
    return (
      <>
        {structured}
        <TitleView
          detail={detail}
          inList={false}
          guest={{ signUpOpen }}
          share={indexable ? share : null}
          kids={kids}
          sponsor={sponsor}
          startAt={startAt}
        />
      </>
    );
  }
  const ids = await getLibrary().myListIds(ctx);
  return (
    <>
      {structured}
      <TitleView
        detail={detail}
        inList={ids.includes(itemKey(detail.video))}
        rating={{ profileId: ctx.profileId, kind: 'video', id: detail.video.id }}
        share={indexable ? share : null}
        kids={kids}
        sponsor={sponsor}
        startAt={startAt}
      />
    </>
  );
}
