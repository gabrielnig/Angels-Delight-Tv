/** Effective text for a key: approved DB row, else baseline JSON, else English (M46 section 4.3). */
import type { CatalogShape, MessageText } from './messages';

export interface DbRow {
  status: 'draft' | 'in_review' | 'approved';
  text: MessageText;
}
export type TextSource = 'db' | 'baseline' | 'english';

export interface MergeInput {
  english: CatalogShape;
  baseline: CatalogShape;
  db: ReadonlyMap<string, DbRow>;
  /** Called when only English is left, so the key can be recorded as missing. */
  onMissing?: (key: string) => void;
}

export function resolveText(
  key: string,
  input: MergeInput,
): { text: MessageText; source: TextSource } {
  const row = input.db.get(key);
  if (row && row.status === 'approved') return { text: row.text, source: 'db' };
  const base = input.baseline[key];
  if (base !== undefined) return { text: base, source: 'baseline' };
  input.onMissing?.(key);
  return { text: input.english[key] ?? key, source: 'english' };
}

/** A catalog holding only what the locale has, DB approved text over baseline. English fills the rest at lookup. */
export function effectiveCatalog(
  baseline: CatalogShape,
  db: ReadonlyMap<string, DbRow>,
): CatalogShape {
  const out: CatalogShape = { ...baseline };
  for (const [key, row] of db) if (row.status === 'approved') out[key] = row.text;
  return out;
}
