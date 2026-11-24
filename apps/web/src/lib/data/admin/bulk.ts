/** Pure types and helpers for the shared bulk action framework (L3, M42). No React, no server code. */

/** Ids per chunk sent from the browser. Small chunks survive slow connections and show progress. */
export const BULK_CHUNK = 25;
/** The most ids a server action accepts in one call. The server slices again. */
export const MAX_BULK_CALL = 200;
/** The most rows one selection can hold, including "select all that match". */
export const MAX_SELECTION = 500;

export interface BulkIssue {
  id: string;
  reason: string;
  /** True for network, timeout or locked row failures. Never for permission or not ready. */
  retryable?: boolean;
}

/** Describes how to put things back, held in client memory for 10 seconds. */
export interface BulkUndo {
  label: string;
  payload: unknown;
}

export interface BulkOutcome {
  bulkId: string;
  succeeded: string[];
  failed: BulkIssue[];
  skipped: BulkIssue[];
  undo?: BulkUndo;
  /** Set when a run stopped early, for example the connection dropped. */
  interrupted?: { done: number; total: number };
}

export function newBulkId(): string {
  return globalThis.crypto.randomUUID();
}

export function emptyOutcome(bulkId: string = newBulkId()): BulkOutcome {
  return { bulkId, succeeded: [], failed: [], skipped: [] };
}

export function chunkIds<T>(ids: readonly T[], size: number = BULK_CHUNK): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < ids.length; i += size) out.push(ids.slice(i, i + size));
  return out;
}

/** Undo steps from several chunks are joined when both payloads are lists, otherwise the later one wins. */
function mergeUndo(a: BulkUndo | undefined, b: BulkUndo | undefined): BulkUndo | undefined {
  if (!a) return b;
  if (!b) return a;
  if (Array.isArray(a.payload) && Array.isArray(b.payload)) {
    return { label: b.label, payload: [...a.payload, ...b.payload] };
  }
  return b;
}

/** Adds two outcomes. A failure in `a` that `b` later succeeded on (a retry) is removed. */
export function mergeOutcomes(a: BulkOutcome, b: BulkOutcome): BulkOutcome {
  const fixed = new Set(b.succeeded);
  const retried = new Set(b.failed.map((f) => f.id));
  return {
    bulkId: a.bulkId,
    succeeded: [...a.succeeded, ...b.succeeded.filter((id) => !a.succeeded.includes(id))],
    failed: [...a.failed.filter((f) => !fixed.has(f.id) && !retried.has(f.id)), ...b.failed],
    skipped: [...a.skipped, ...b.skipped],
    undo: mergeUndo(a.undo, b.undo),
    interrupted: b.interrupted,
  };
}

/** The one sentence summary: "Publish: 9 done, 2 could not be changed, 1 skipped." */
export function describeOutcome(label: string, outcome: BulkOutcome): string {
  const parts: string[] = [`${outcome.succeeded.length} done`];
  if (outcome.failed.length > 0) parts.push(`${outcome.failed.length} could not be changed`);
  if (outcome.skipped.length > 0) parts.push(`${outcome.skipped.length} skipped`);
  return `${label}: ${parts.join(', ')}.`;
}

/** Splits selected rows into those a rule accepts and those it skips, with a reason for each skipped one. */
export function eligibility<T extends { id: string }>(
  rows: readonly T[],
  rule: (row: T) => string | null,
): { eligible: T[]; skipped: BulkIssue[] } {
  const eligible: T[] = [];
  const skipped: BulkIssue[] = [];
  for (const row of rows) {
    const reason = rule(row);
    if (reason === null) eligible.push(row);
    else skipped.push({ id: row.id, reason });
  }
  return { eligible, skipped };
}

export function capSelection(ids: readonly string[]): { ids: string[]; capped: boolean; total: number } {
  return { ids: ids.slice(0, MAX_SELECTION), capped: ids.length > MAX_SELECTION, total: ids.length };
}

/** Only failures marked retryable can be retried. Skipped items never are. */
export function retryableFailures(outcome: BulkOutcome): BulkIssue[] {
  return outcome.failed.filter((f) => f.retryable === true);
}

/** Fills in what a server result leaves out (no skipped list, no bulk id) so it can be merged. */
export function toOutcome(
  result: {
    succeeded: string[];
    failed: BulkIssue[];
    skipped?: BulkIssue[];
    undo?: BulkUndo;
    bulkId?: string;
  },
  bulkId: string,
): BulkOutcome {
  return {
    bulkId: result.bulkId ?? bulkId,
    succeeded: result.succeeded,
    failed: result.failed,
    skipped: result.skipped ?? [],
    undo: result.undo,
  };
}
