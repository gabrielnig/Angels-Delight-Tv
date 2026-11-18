import { notFound, redirect } from 'next/navigation';
import { Badge } from '@ad/ui';
import { AppShell } from '../../../../components/Shell';
import { EpisodeList } from '../../../../components/title/EpisodeList';
import { TitleActions } from '../../../../components/title/TitleActions';
import { pickSeason, seasonRows } from '../../../../components/title/series-rows';
import { getCatalog, getLibrary } from '../../../../lib/data';
import { itemKey } from '../../../../lib/format';
import { primaryAction } from '../../../../lib/title-cta';
import { requireProfile } from '../../../../lib/session';

export default async function SeriesPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const { ctx } = await requireProfile(`/series/${slug}`);
  const detail = await getCatalog().series(ctx, slug);
  if (!detail) notFound();
  if ('redirect' in detail) redirect(detail.redirect);
  const { series, seasons, next } = detail;
  const nextVideo = seasons.flatMap((s) => s.episodes).find((e) => e.video.id === next.videoId);
  const rows = seasonRows(seasons);
  const inList = (await getLibrary().myListIds(ctx)).includes(itemKey(series));
  return (
    <AppShell>
      <div className="web-page web-title">
        <h1 className="web-title__name">{series.title}</h1>
        <p className="web-title__meta">
          <Badge variant="neutral">{`${series.seasonCount} ${series.seasonCount === 1 ? 'season' : 'seasons'}`}</Badge>{' '}
          <span>{series.categoryName}</span>
        </p>
        {nextVideo ? (
          <TitleActions
            primary={primaryAction({
              label: next.label,
              startSeconds: 0,
              watchHref: `/watch/${nextVideo.video.id}`,
              episode: { season: next.season, number: next.episode },
            })}
            itemKey={itemKey(series)}
            inList={inList}
            shareTitle={series.title}
          />
        ) : null}
        <p className="web-title__desc">{series.description}</p>
        <EpisodeList seasons={rows} initialSeason={pickSeason(seasons, query.season, next.season)} />
      </div>
    </AppShell>
  );
}
