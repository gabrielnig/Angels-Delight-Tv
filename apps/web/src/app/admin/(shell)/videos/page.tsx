import type { Metadata } from 'next';
import { LinkButton } from '@/components/admin/Button';
import { PageHeader } from '@/components/admin/PageHeader';
import { VideosList } from '@/components/admin/VideosList';
import { can } from '@/lib/admin/can';
import { collectionService, videoService } from '@/lib/data/admin/services';
import { requireActor } from '@/lib/data/admin/session-next';
import { parseVideoQuery } from '@/lib/data/admin/video-queries';
import {
  createSeriesForBundleAction,
  seriesNumbersAction,
  setEpisodeAction,
} from '../series/actions';
import { bulkVideosAction, matchingVideoIdsAction, undoBulkVideosAction } from './actions';

export const metadata: Metadata = { title: 'Videos' };

export default async function VideosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const actor = await requireActor('/admin/videos');
  const query = parseVideoQuery(await searchParams);
  const [page, categories] = await Promise.all([
    videoService.list(actor, query),
    videoService.categories(actor),
  ]);
  const seriesList = can(actor.role, 'series.manage')
    ? await collectionService.seriesList(actor)
    : null;
  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Admin', href: '/admin' }, { label: 'Videos' }]}
        title="Videos"
        actions={
          <LinkButton href="/admin/videos/upload" variant="accent" icon="upload">
            Upload videos
          </LinkButton>
        }
      />
      <VideosList
        page={page}
        query={query}
        categories={categories}
        role={actor.role}
        bulk={bulkVideosAction}
        undo={undoBulkVideosAction}
        matching={matchingVideoIdsAction}
        bundle={
          seriesList
            ? {
                series: seriesList.map((s) => ({ id: s.id, title: s.title, labels: s.labels })),
                existing: seriesNumbersAction,
                setEpisode: setEpisodeAction,
                createSeries: createSeriesForBundleAction,
              }
            : undefined
        }
        now={Date.now()}
      />
    </>
  );
}
