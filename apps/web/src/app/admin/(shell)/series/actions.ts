'use server';

import { revalidatePath } from 'next/cache';
import { collectionService } from '@/lib/data/admin/services';
import { requireActor } from '@/lib/data/admin/session-next';
import type { SeriesPatch } from '@/lib/data/admin/collection-commands';
import type { CommandResult } from '@/lib/data/admin/video-commands';

async function run(
  fn: (actor: Awaited<ReturnType<typeof requireActor>>) => Promise<CommandResult>,
) {
  const actor = await requireActor('/admin/series');
  const result = await fn(actor);
  revalidatePath('/admin', 'layout');
  return result;
}

export const createSeriesAction = (title: string, description: string) =>
  run((a) =>
    collectionService.createSeries(a, { title: String(title), description: String(description) }),
  );
export const updateSeriesAction = (id: string, patch: SeriesPatch) =>
  run((a) =>
    collectionService.updateSeries(a, String(id), {
      title: patch.title === undefined ? undefined : String(patch.title),
      description: patch.description === undefined ? undefined : String(patch.description),
      published: patch.published === undefined ? undefined : Boolean(patch.published),
    }),
  );
export const deleteSeriesAction = (id: string) =>
  run((a) => collectionService.deleteSeries(a, String(id)));
export const setEpisodeAction = (
  videoId: string,
  seriesId: string | null,
  season: number | null,
  episode: number | null,
) =>
  run((a) =>
    collectionService.setEpisode(
      a,
      String(videoId),
      seriesId ? String(seriesId) : null,
      Number.isInteger(season) && season! > 0 ? season : null,
      Number.isInteger(episode) && episode! > 0 ? episode : null,
    ),
  );
