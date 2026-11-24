const DEFAULT_AFTER_ROW = 3;
const MIN_AFTER_ROW = 2;

/**
 * Where the Home banner goes among the curated rows: the index to insert at, or -1 for no banner. It never sits
 * above the second row, and there must be a row for it to come after.
 */
export function bannerIndex(rowCount: number, afterRow: number): number {
  const wanted = Number.isFinite(afterRow) ? Math.trunc(afterRow) : DEFAULT_AFTER_ROW;
  const at = Math.max(MIN_AFTER_ROW, wanted);
  return rowCount >= at ? at : -1;
}
