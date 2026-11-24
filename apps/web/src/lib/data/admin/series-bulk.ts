import type { BulkIssue, BulkOutcome, BulkUndo } from './bulk';
import type { AdminActor } from './types';
import type { CommandResult } from './video-commands';
import { can } from '@/lib/admin/can';
import type { CollectionService } from './services';

export type SeriesBulkAction = { type: 'publish' } | { type: 'unpublish' } | { type: 'delete' };

/** The parts of the series service a bulk run needs. */
export interface SeriesBulkService {
  list(): Promise<Array<{ id: string; published: boolean }>>;
  update(id: string, patch: { published: boolean }): Promise<CommandResult>;
  remove(id: string): Promise<CommandResult>;
}

export interface SeriesUndoStep {
  type: 'publish' | 'unpublish';
  ids: string[];
}

const NEEDS_EPISODE = /^Publish at least one episode/;

/**
 * Runs publish, unpublish or delete over series, one at a time (L3-D12). Publish follows the series
 * visibility rule per id: one with no published episode is skipped with its reason. A series already in
 * the wanted state is skipped. Delete has no undo: it removes seasons too.
 */
export async function runSeriesBulk(
  service: SeriesBulkService,
  ids: readonly string[],
  action: SeriesBulkAction,
  bulkId: string,
): Promise<BulkOutcome> {
  const before = new Map((await service.list()).map((s) => [s.id, s.published]));
  const out: BulkOutcome = { bulkId, succeeded: [], failed: [], skipped: [] };
  for (const id of new Set(ids)) {
    if (!before.has(id)) {
      out.failed.push({ id, reason: 'That series no longer exists.', retryable: false });
      continue;
    }
    const published = before.get(id)!;
    if (action.type === 'publish' && published) {
      out.skipped.push({ id, reason: 'Already published.' });
      continue;
    }
    if (action.type === 'unpublish' && !published) {
      out.skipped.push({ id, reason: 'Not published.' });
      continue;
    }
    try {
      const done =
        action.type === 'delete'
          ? await service.remove(id)
          : await service.update(id, { published: action.type === 'publish' });
      if (done.ok) out.succeeded.push(id);
      else if (NEEDS_EPISODE.test(done.error)) out.skipped.push({ id, reason: done.error });
      else out.failed.push({ id, reason: done.error, retryable: false } satisfies BulkIssue);
    } catch {
      out.failed.push({ id, reason: 'That did not work. Try again.', retryable: true });
    }
  }
  if (action.type !== 'delete' && out.succeeded.length) {
    const steps: SeriesUndoStep[] = [
      { type: action.type === 'publish' ? 'unpublish' : 'publish', ids: [...out.succeeded] },
    ];
    out.undo = { label: action.type === 'publish' ? 'Publish series' : 'Unpublish series', payload: steps };
  }
  return out;
}

/** Compare and set: an id is only put back while it is still in the state the run left it in. */
export function planSeriesUndo(undo: BulkUndo, current: Record<string, boolean>): SeriesUndoStep[] {
  const out: SeriesUndoStep[] = [];
  for (const step of undo.payload as SeriesUndoStep[]) {
    const wantCurrent = step.type === 'unpublish';
    const ids = step.ids.filter((id) => current[id] === wantCurrent);
    if (ids.length) out.push({ type: step.type, ids });
  }
  return out;
}

/** Applies an undo descriptor. Returns what was put back and what could not be. */
export async function undoSeriesBulk(
  service: SeriesBulkService,
  undo: BulkUndo,
): Promise<{ succeeded: string[]; failed: BulkIssue[] }> {
  const current = Object.fromEntries((await service.list()).map((s) => [s.id, s.published]));
  const out = { succeeded: [] as string[], failed: [] as BulkIssue[] };
  for (const step of planSeriesUndo(undo, current)) {
    for (const id of step.ids) {
      const done = await service.update(id, { published: step.type === 'publish' });
      if (done.ok) out.succeeded.push(id);
      else out.failed.push({ id, reason: done.error });
    }
  }
  return out;
}

/** Adapts a collection service to what a bulk run needs. Delete answers per id for roles below admin. */
export function seriesBulkFor(
  service: Pick<CollectionService, 'seriesList' | 'updateSeries' | 'deleteSeries'>,
  actor: AdminActor,
): SeriesBulkService {
  return {
    async list() {
      return (await service.seriesList(actor)).map((s) => ({ id: s.id, published: s.published }));
    },
    update: (id, patch) => service.updateSeries(actor, id, patch),
    async remove(id) {
      if (!can(actor.role, 'series.delete'))
        return { ok: false, error: 'Only an admin can delete a series.' };
      return service.deleteSeries(actor, id);
    },
  };
}
