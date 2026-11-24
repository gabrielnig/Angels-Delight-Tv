import { validateTranslation, type CatalogShape, type MessageText } from '@ad/shared/messages';
import { parseCsv } from './csv';
import { hashText, type TranslationRow } from './status';

export const IMPORT_MAX_ROWS = 5000;
export const IMPORT_MAX_BYTES = 2 * 1024 * 1024;

export class ImportRefused extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ImportRefused';
  }
}

export interface PlannedRow {
  row: number;
  key: string;
}
export interface ImportPlan {
  added: PlannedRow[];
  changed: PlannedRow[];
  unchanged: PlannedRow[];
  rejected: { row: number; key: string; reason: string }[];
  blank: number;
  /** Rows to write. Always `in_review`: a spreadsheet can never approve anything. */
  writes: { key: string; text: MessageText; status: 'in_review'; sourceHash: string }[];
}

function readCell(value: string, english: MessageText): MessageText | null {
  const v = value.trim();
  if (typeof english !== 'string' && v.startsWith('{')) {
    try {
      const parsed = JSON.parse(v) as unknown;
      if (parsed && typeof parsed === 'object') return parsed as MessageText;
    } catch {
      return null;
    }
    return null;
  }
  return v;
}

const same = (a: MessageText, b: MessageText) => JSON.stringify(norm(a)) === JSON.stringify(norm(b));
function norm(text: MessageText): unknown {
  return typeof text === 'string'
    ? text.trim().normalize('NFC')
    : Object.fromEntries(Object.entries(text).sort().map(([k, v]) => [k, String(v).trim().normalize('NFC')]));
}

export function planImport(input: {
  locale: string;
  english: CatalogShape;
  baseline: CatalogShape;
  existing: readonly TranslationRow[];
  csv: string;
}): ImportPlan {
  if (new TextEncoder().encode(input.csv).length > IMPORT_MAX_BYTES) throw new ImportRefused('The file is over 2 MB');
  const table = parseCsv(input.csv);
  const head = (table[0] ?? []).map((h) => h.trim().toLowerCase());
  const keyCol = head.indexOf('key');
  const textCol = head.indexOf('translation');
  if (keyCol < 0 || textCol < 0) throw new ImportRefused('The file needs key and translation columns');
  const body = table.slice(1).filter((r) => r.some((c) => c.trim() !== ''));
  if (body.length > IMPORT_MAX_ROWS) throw new ImportRefused('The file has more than 5,000 rows');

  const existing = new Map(input.existing.map((r) => [r.key, r.text]));
  const plan: ImportPlan = { added: [], changed: [], unchanged: [], rejected: [], blank: 0, writes: [] };
  body.forEach((cells, index) => {
    const row = index + 2;
    const key = (cells[keyCol] ?? '').trim();
    const english = input.english[key];
    if (english === undefined) {
      plan.rejected.push({ row, key, reason: 'Unknown key' });
      return;
    }
    const raw = cells[textCol] ?? '';
    if (raw.trim() === '') {
      plan.blank++;
      return;
    }
    const text = readCell(raw, english);
    if (text === null) {
      plan.rejected.push({ row, key, reason: 'The plural text is not valid' });
      return;
    }
    const result = validateTranslation({ locale: input.locale, english, text });
    if (result.errors.length > 0) {
      plan.rejected.push({ row, key, reason: result.errors.join('; ') });
      return;
    }
    const current = existing.get(key) ?? input.baseline[key];
    if (current !== undefined && same(current, result.normalized)) {
      plan.unchanged.push({ row, key });
      return;
    }
    (current === undefined ? plan.added : plan.changed).push({ row, key });
    plan.writes.push({ key, text: result.normalized, status: 'in_review', sourceHash: hashText(english) });
  });
  return plan;
}
