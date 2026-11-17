import { notFound } from 'next/navigation';
import { Badge, ButtonLink } from '@ad/ui';
import { AppShell } from '../../../../components/Shell';
import { EpisodeList } from '../../../../components/title/EpisodeList';
import { getCatalog } from '../../../../lib/data';
import { percent } from '../../../../lib/format';
import { requireProfile } from '../../../../lib/session';

export default async function SeriesPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { ctx } = await requireProfile(`/series/${slug}`);
  const detail = await getCatalog().series(ctx, slug);
  if (!detail) notFound();
  const { series, seasons, next } = detail;
  const nextVideo = seasons.flatMap((s) => s.episodes).find((e) => e.video.id === next.videoId);
  const rows = seasons.map((s) => ({
    number: s.number,
    episodes: s.episodes.map((e) => {
      const p = e.progress ? percent(e.progress) : 0;
      return {
        number: e.number,
        title: e.video.title,
        blurb: e.blurb,
        durationSeconds: e.video.durationSeconds,
        href: `/watch/${e.video.slug}`,
        watched: e.watched,
        percent: p > 0 && p < 100 ? p : undefined,
      };
    }),
  }));
  return (
    <AppShell>
      <div className="web-page web-title">
        <h1 className="web-title__name">{series.title}</h1>
        <p className="web-title__meta">
          <Badge variant="neutral">{`${series.seasonCount} ${series.seasonCount === 1 ? 'season' : 'seasons'}`}</Badge>{' '}
          <span>{series.categoryName}</span>
        </p>
        {nextVideo ? (
          <div className="web-title-actions">
            <ButtonLink href={`/watch/${nextVideo.video.slug}`} icon="play">
              {next.resume
                ? `Resume S${next.season} E${next.episode}`
                : `Start S${next.season} E${next.episode}`}
            </ButtonLink>
          </div>
        ) : null}
        <p className="web-title__desc">{series.description}</p>
        <EpisodeList seasons={rows} initialSeason={next.season} />
      </div>
    </AppShell>
  );
}
