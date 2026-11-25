import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import { Badge } from '@ad/ui';
import { groupCount, resolveSeriesLabels } from '@ad/shared/series-labels';
import { AppShell } from '../../../../components/Shell';
import { PublicSeries } from '../../../../components/title/TitleView';
import { GuestEpisodeProgress } from '../../../../components/guest/GuestEpisodeProgress';
import { EpisodeList } from '../../../../components/title/EpisodeList';
import { TitleActions } from '../../../../components/title/TitleActions';
import { pickSeason, seasonRows } from '../../../../components/title/series-rows';
import { getCatalog, getLibrary } from '../../../../lib/data';
import { JsonLd } from '../../../../components/seo/JsonLd';
import { previewMetadata } from '../../../../lib/seo';
import { seriesPageJsonLd } from '../../../../lib/seo/page-jsonld';
import { shareConfig, siteOrigin, titleIndexable } from '../../../../server/seo/page-seo';
import { getRootTheme } from '../../../../lib/theme/root';
import { itemKey } from '../../../../lib/format';
import { primaryAction } from '../../../../lib/title-cta';
import { getSite } from '../../../../lib/data';
import { getViewerOrGuest } from '../../../../lib/session';
import { guestPlayEnabled } from '../../../../server/guest/guest-settings';

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const preview = await getCatalog().publicPreview(slug, 'series');
  if (!preview || preview.type !== 'series') {
    return { title: 'Series not found', robots: { index: false, follow: false } };
  }
  const { item } = preview;
  const [{ platformName }, indexable] = await Promise.all([
    getRootTheme(),
    titleIndexable('series', item.slug),
  ]);
  return previewMetadata({
    kind: 'series',
    title: item.title,
    description: item.description,
    path: `/series/${item.slug}`,
    siteName: platformName,
    thumbnail: item.thumbnail,
    indexable,
    shareImagePath: `/og/series/${encodeURIComponent(item.slug)}?v=${encodeURIComponent(item.publishedAt ?? '')}`,
  });
}

export default async function SeriesPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const viewer = await getViewerOrGuest(`/series/${slug}`);
  if (viewer.kind === 'guest' && !(await guestPlayEnabled())) {
    const preview = await getCatalog().publicPreview(slug, 'series');
    if (!preview) notFound();
    if (preview.type === 'redirect') permanentRedirect(preview.to);
    if (preview.type !== 'series') notFound();
    const { item } = preview;
    return (
      <AppShell>
        <PublicSeries
          slug={item.slug}
          title={item.title}
          description={item.description}
          episodes={item.episodeCount}
          labels={item.labels}
          category={item.categoryName}
          thumbnail={item.thumbnail}
        />
      </AppShell>
    );
  }
  const { ctx } = viewer;
  const detail = await getCatalog().series(ctx, slug);
  if (!detail) notFound();
  if ('redirect' in detail) permanentRedirect(detail.redirect);
  const { series, seasons, next } = detail;
  const nextVideo = seasons.flatMap((s) => s.episodes).find((e) => e.video.id === next.videoId);
  const rows = seasonRows(seasons);
  const words = resolveSeriesLabels(series.labels, null);
  const guest =
    viewer.kind === 'guest' ? { signUpOpen: (await getSite().content()).signUpOpen } : null;
  const inList = guest ? false : (await getLibrary().myListIds(ctx)).includes(itemKey(series));
  const [indexable, share] = await Promise.all([
    titleIndexable('series', series.slug),
    shareConfig(series.title),
  ]);
  return (
    <AppShell>
      {indexable ? (
        <JsonLd data={seriesPageJsonLd({ origin: siteOrigin(), series, seasons })} />
      ) : null}
      <div className="web-page web-title">
        <h1 className="web-title__name">{series.title}</h1>
        <p className="web-title__meta">
          <Badge variant="neutral">{groupCount(words, series.seasonCount)}</Badge>{' '}
          <span>{series.categoryName}</span>
        </p>
        {nextVideo ? (
          <TitleActions
            primary={primaryAction({
              label: next.label,
              startSeconds: 0,
              watchHref: `/watch/${nextVideo.video.id}`,
              episode: { season: next.season, number: next.episode, labels: series.labels },
            })}
            itemKey={itemKey(series)}
            inList={inList}
            shareTitle={series.title}
            share={share}
            kids={ctx.audience === 'kids'}
            kind="series"
            guest={guest ? { signUpOpen: guest.signUpOpen, next: `/series/${slug}` } : undefined}
          />
        ) : null}
        <p className="web-title__desc">{series.description}</p>
        {guest ? (
          <GuestEpisodeProgress
            labels={series.labels}
            seasons={rows}
            initialSeason={pickSeason(seasons, query.season, next.season)}
          />
        ) : (
          <EpisodeList
            labels={series.labels}
            seasons={rows}
            initialSeason={pickSeason(seasons, query.season, next.season)}
          />
        )}
      </div>
    </AppShell>
  );
}
