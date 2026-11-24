import type { CatalogShape, MessageText } from '@ad/shared/messages';
import { toCsv } from './csv';
import { hashText, type TranslationRow } from './status';

export interface ExportInput {
  locale: string;
  english: CatalogShape;
  baseline: CatalogShape;
  rows: readonly TranslationRow[];
}

/** Plural text travels in a cell as a JSON object, plain text as itself. */
export function cellText(text: MessageText): string {
  return typeof text === 'string' ? text : JSON.stringify(text);
}

export function exportCsv(input: ExportInput): string {
  const byKey = new Map(input.rows.map((r) => [r.key, r]));
  const out: string[][] = [['key', 'area', 'english', 'translation', 'status', 'note']];
  for (const [key, english] of Object.entries(input.english)) {
    const row = byKey.get(key);
    const base = input.baseline[key];
    let status = 'missing';
    let translation = '';
    if (row) {
      translation = cellText(row.text);
      status = row.sourceHash && row.sourceHash !== hashText(english) ? 'stale' : row.status;
    } else if (base !== undefined) {
      translation = cellText(base);
      status = 'approved';
    }
    out.push([key, key.split('.')[0] ?? '', cellText(english), translation, status, row?.note ?? '']);
  }
  return toCsv(out);
}

/** The effective catalog (baseline, then approved rows), flat key to text, ready to commit as the next baseline. */
export function exportJson(input: ExportInput): string {
  const approved = new Map(input.rows.filter((r) => r.status === 'approved').map((r) => [r.key, r.text]));
  const out: Record<string, MessageText> = {};
  for (const key of Object.keys(input.english)) {
    const text = approved.get(key) ?? input.baseline[key];
    if (text !== undefined) out[key] = text;
  }
  return JSON.stringify(out, null, 2) + '\n';
}
