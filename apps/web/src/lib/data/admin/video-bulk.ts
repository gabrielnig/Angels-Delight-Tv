import type { BulkUndo } from './bulk';
import type { BulkAction, BulkResult } from './video-queries';
import type { AdminActor, Suitability, VideoRecord } from './types';

/** What undo needs to know about a video before a bulk run. */
export interface VideoSnapshot {
  publishState: VideoRecord['publishState'];
  suitability: Suitability | null;
  categoryIds: string[];
}

export type UndoStep =
  | { kind: 'restore'; ids: string[] }
  | { kind: 'bulk'; action: BulkAction; ids: string[]; expectSuitability?: Suitability };

export function snapshotOf(video: VideoRecord): VideoSnapshot {
  return {
    publishState: video.publishState,
    suitability: video.suitability,
    categoryIds: [...video.categoryIds],
  };
}

const PERMANENT = [
  /^Not ready/,
  /no longer exists/,
  /do not have permission/,
  /^Only an admin/,
  /^Pick categories/,
];

/** Network and server hiccups can be retried. Permission, not ready and missing items cannot. */
export function markRetryable(failed: BulkResult['failed']): BulkResult['failed'] {
  return failed.map((f) => ({ ...f, retryable: !PERMANENT.some((p) => p.test(f.reason)) }));
}

/**
 * Builds the undo descriptor for a run (L3-D07) from the state each succeeded video had before it. Returns
 * undefined when there is nothing to put back.
 */
export function buildUndo(
  action: BulkAction,
  before: Record<string, VideoSnapshot>,
  succeeded: readonly string[],
): BulkUndo | undefined {
  const steps: UndoStep[] = [];
  const known = succeeded.filter((id) => before[id] !== undefined || action.type === 'trash');
  switch (action.type) {
    case 'trash':
      if (succeeded.length) steps.push({ kind: 'restore', ids: [...succeeded] });
      break;
    case 'publish': {
      const ids = known.filter((id) => before[id]!.publishState !== 'published');
      if (ids.length) steps.push({ kind: 'bulk', action: { type: 'unpublish' }, ids });
      break;
    }
    case 'unpublish': {
      const ids = known.filter((id) => before[id]!.publishState === 'published');
      if (ids.length) steps.push({ kind: 'bulk', action: { type: 'publish' }, ids });
      break;
    }
    case 'category': {
      const ids = known.filter((id) => !before[id]!.categoryIds.includes(action.categoryId));
      if (ids.length)
        steps.push({ kind: 'bulk', action: { type: 'remove_category', categoryId: action.categoryId }, ids });
      break;
    }
    case 'remove_category': {
      const ids = known.filter((id) => before[id]!.categoryIds.includes(action.categoryId));
      if (ids.length)
        steps.push({ kind: 'bulk', action: { type: 'category', categoryId: action.categoryId }, ids });
      break;
    }
    case 'suitability': {
      for (const id of known) {
        const previous = before[id]!.suitability;
        if (previous === null || previous === action.value) continue;
        const last = steps.find(
          (s) => s.kind === 'bulk' && s.action.type === 'suitability' && s.action.value === previous,
        );
        if (last) last.ids.push(id);
        else
          steps.push({
            kind: 'bulk',
            action: { type: 'suitability', value: previous },
            ids: [id],
            expectSuitability: action.value,
          });
      }
      break;
    }
  }
  if (steps.length === 0) return undefined;
  return { label: undoLabel(action), payload: steps };
}

function undoLabel(action: BulkAction): string {
  switch (action.type) {
    case 'trash':
      return 'Move to Trash. Undo brings the videos back as drafts.';
    case 'publish':
      return 'Publish';
    case 'unpublish':
      return 'Unpublish';
    case 'category':
      return 'Add to category';
    case 'remove_category':
      return 'Remove from category';
    case 'suitability':
      return 'Set suitability';
  }
}

/**
 * Turns a descriptor into the calls to make now, using compare and set: an id is only reverted while it is
 * still in the state the run left it in.
 */
export function planUndo(undo: BulkUndo, current: Record<string, VideoSnapshot>): UndoStep[] {
  const steps = undo.payload as UndoStep[];
  const out: UndoStep[] = [];
  for (const step of steps) {
    if (step.kind === 'restore') {
      out.push(step);
      continue;
    }
    const { action } = step;
    let ids: string[];
    switch (action.type) {
      case 'unpublish':
        ids = step.ids.filter((id) => current[id]?.publishState === 'published');
        break;
      case 'publish':
        ids = step.ids.filter((id) => current[id] !== undefined && current[id]!.publishState !== 'published');
        break;
      case 'remove_category':
        ids = step.ids.filter((id) => current[id]?.categoryIds.includes(action.categoryId));
        break;
      case 'category':
        ids = step.ids.filter((id) => current[id] !== undefined && !current[id]!.categoryIds.includes(action.categoryId));
        break;
      case 'suitability':
        ids = step.ids.filter((id) => current[id]?.suitability === step.expectSuitability);
        break;
      default:
        ids = step.ids;
    }
    if (ids.length) out.push({ ...step, ids });
  }
  return out;
}

/** The parts of the video service a bulk run needs. */
export interface BulkVideoService {
  get(actor: AdminActor, id: string): Promise<VideoRecord>;
  bulk(actor: AdminActor, ids: string[], action: BulkAction): Promise<BulkResult>;
  restore(actor: AdminActor, id: string): Promise<{ ok: boolean; error?: string }>;
}

async function snapshots(
  service: BulkVideoService,
  actor: AdminActor,
  ids: readonly string[],
): Promise<Record<string, VideoSnapshot>> {
  const settled = await Promise.allSettled(ids.map((id) => service.get(actor, id)));
  const out: Record<string, VideoSnapshot> = {};
  settled.forEach((r, i) => {
    if (r.status === 'fulfilled') out[ids[i]!] = snapshotOf(r.value);
  });
  return out;
}

/** Runs one chunk: captures the state before, applies the action, and returns the result with undo and marks. */
export async function runVideoBulk(
  service: BulkVideoService,
  actor: AdminActor,
  ids: string[],
  action: BulkAction,
  bulkId: string,
): Promise<BulkResult> {
  const before = action.type === 'trash' ? {} : await snapshots(service, actor, ids);
  const result = await service.bulk(actor, ids, action);
  return {
    ...result,
    failed: markRetryable(result.failed),
    bulkId,
    undo: buildUndo(action, before, result.succeeded),
  };
}

/** Applies an undo descriptor with compare and set. Returns what was put back and what could not be. */
export async function undoVideoBulk(
  service: BulkVideoService,
  actor: AdminActor,
  undo: BulkUndo,
): Promise<BulkResult> {
  const steps = undo.payload as UndoStep[];
  const needsState = steps.some((s) => s.kind === 'bulk');
  const current = needsState ? await snapshots(service, actor, steps.flatMap((s) => s.ids)) : {};
  const out: BulkResult = { succeeded: [], failed: [] };
  for (const step of planUndo(undo, current)) {
    if (step.kind === 'restore') {
      for (const id of step.ids) {
        const r = await service.restore(actor, id);
        if (r.ok) out.succeeded.push(id);
        else out.failed.push({ id, reason: r.error ?? 'Could not restore.' });
      }
      continue;
    }
    const r = await service.bulk(actor, step.ids, step.action);
    out.succeeded.push(...r.succeeded);
    out.failed.push(...r.failed);
  }
  return out;
}
