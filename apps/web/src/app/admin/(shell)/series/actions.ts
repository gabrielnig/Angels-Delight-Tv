'use server';

import { revalidatePath } from 'next/cache';
import { MAX_BULK_CALL, newBulkId, type BulkOutcome, type BulkUndo } from '@/lib/data/admin/bulk';
import type { SeriesBulkAction } from '@/lib/data/admin/series-bulk';
import { auditBulkRun } from '@/server/admin/bulk-run';
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

/** Publish, unpublish or delete many series. Delete is admin only and has no undo. */
export async function bulkSeriesAction(
  ids: string[],
  action: SeriesBulkAction,
  bulkId: string = newBulkId(),
): Promise<BulkOutcome> {
  const actor = await requireActionActor('/admin/series');
  const used = ids.slice(0, MAX_BULK_CALL);
  const outcome = await collectionService.bulkSeries(actor, used, action, bulkId);
  await auditBulkRun(
    { accountId: actor.accountId, role: actor.role },
    {
      action: `series.bulk_${action.type}`,
      label: action.type === 'delete' ? 'Delete series' : `${action.type === 'publish' ? 'Publish' : 'Unpublish'} series`,
      targetType: 'series',
      bulkId,
      ids: used,
      outcome,
    },
  );
  revalidatePath('/admin', 'layout');
  return outcome;
}

export async function undoBulkSeriesAction(undo: BulkUndo) {
  const actor = await requireActionActor('/admin/series');
  const result = await collectionService.undoSeries(actor, undo);
  revalidatePath('/admin', 'layout');
  return result;
}
