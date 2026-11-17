'use server';

import { revalidatePath } from 'next/cache';
import { collectionService } from '@/lib/data/admin/services';
import { requireActionActor } from '@/lib/data/admin/session-next';
import type { SeriesPatch } from '@/lib/data/admin/collection-commands';
import type { CommandResult } from '@/lib/data/admin/video-commands';

async function run(
  fn: (actor: Awaited<ReturnType<typeof requireActionActor>>) => Promise<CommandResult>,
) {
  const actor = await requireActionActor('/admin/series');
  const result = await fn(actor);
  revalidatePath('/admin', 'layout');
  return result;
}

export async function createSeriesAction(title: string, description: string) {
  return run((a) =>
    collectionService.createSeries(a, { title: String(title), description: String(description) }),
  );
}

export async function updateSeriesAction(id: string, patch: SeriesPatch) {
  return run((a) =>
    collectionService.updateSeries(a, String(id), {
      title: patch.title === undefined ? undefined : String(patch.title),
      description: patch.description === undefined ? undefined : String(patch.description),
      published: patch.published === undefined ? undefined : Boolean(patch.published),
    }),
  );
}

export async function deleteSeriesAction(id: string) {
  return run((a) => collectionService.deleteSeries(a, String(id)));
}

export async function setEpisodeAction(
  videoId: string,
  seriesId: string | null,
  season: number | null,
  episode: number | null,
) {
  return run((a) =>
    collectionService.setEpisode(
      a,
      String(videoId),
      seriesId ? String(seriesId) : null,
      Number.isInteger(season) && season! > 0 ? season : null,
      Number.isInteger(episode) && episode! > 0 ? episode : null,
    ),
  );
}
