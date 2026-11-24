import { hashText, summarize, type TranslationRow } from '@ad/i18n/status';
import {
  LOCALES,
  pluralCategoriesFor,
  type CatalogShape,
  type MessageText,
} from '@ad/shared/messages';

export interface LanguageRow {
  code: string;
  endonym: string;
  englishName: string;
  state: 'off' | 'draft' | 'live';
  percent: number;
  missing: number;
  stale: number;
  inReview: number;
  approved: number;
  total: number;
  canPublish: boolean;
  /** Why Publish is unavailable. */
  reason?: string;
}

export function buildLanguageRows(input: {
  english: CatalogShape;
  enabled: readonly string[];
  min: number;
  rowsByLocale: Record<string, readonly TranslationRow[]>;
  baselines: Record<string, CatalogShape>;
}): LanguageRow[] {
  return LOCALES.filter((l) => !l.source).map((locale) => {
    const rows = input.rowsByLocale[locale.code] ?? [];
    const baseline = input.baselines[locale.code] ?? {};
    const s = summarize({ locale: locale.code, english: input.english, baseline, rows });
    const live = input.enabled.includes(locale.code);
    const hasText = rows.length > 0 || Object.keys(baseline).length > 0;
    const canPublish = s.approvedPercent >= input.min;
    return {
      code: locale.code,
      endonym: locale.endonym,
      englishName: locale.englishName,
      state: live ? 'live' : hasText ? 'draft' : 'off',
      percent: s.approvedPercent,
      missing: s.missing.length,
      stale: s.stale.length,
      inReview: s.inReview.length,
      approved: s.approved.length,
      total: s.total,
      canPublish,
      ...(canPublish
        ? {}
        : { reason: `${s.approvedPercent} percent of core text is approved. Publishing needs ${input.min} percent` }),
    };
  });
}

export type WorkspaceStatus = 'missing' | 'stale' | 'in_review' | 'approved' | 'draft';

export interface WorkspaceRow {
  key: string;
  area: string;
  english: MessageText;
  text: MessageText | null;
  status: WorkspaceStatus;
  note: string | null;
  placeholders: string[];
  /** Plural categories the locale uses, empty for a plain text. */
  categories: string[];
}

const placeholdersOf = (text: MessageText): string[] => {
  const all = typeof text === 'string' ? [text] : Object.values(text);
  return [...new Set(all.flatMap((t) => [...String(t).matchAll(/\{(\w+)\}/g)].map((m) => m[1]!)))];
};

export function buildWorkspaceRows(input: {
  locale: string;
  english: CatalogShape;
  baseline: CatalogShape;
  rows: readonly TranslationRow[];
}): WorkspaceRow[] {
  const byKey = new Map(input.rows.map((r) => [r.key, r]));
  return Object.entries(input.english).map(([key, english]) => {
    const row = byKey.get(key);
    const baseline = input.baseline[key];
    let status: WorkspaceStatus = 'missing';
    if (row) {
      status = row.sourceHash && row.sourceHash !== hashText(english) ? 'stale' : row.status;
    } else if (baseline !== undefined) status = 'approved';
    return {
      key,
      area: key.split('.')[0] ?? '',
      english,
      text: row ? row.text : (baseline ?? null),
      status,
      note: row?.note ?? null,
      placeholders: placeholdersOf(english),
      categories: typeof english === 'string' ? [] : pluralCategoriesFor(input.locale),
    };
  });
}

export function filterWorkspaceRows(
  rows: readonly WorkspaceRow[],
  f: { status?: string; area?: string; q?: string },
): WorkspaceRow[] {
  const q = f.q?.trim().toLowerCase();
  const flat = (t: MessageText | null) => (t === null ? '' : typeof t === 'string' ? t : Object.values(t).join(' '));
  return rows.filter(
    (r) =>
      (!f.status || f.status === 'all' || r.status === f.status) &&
      (!f.area || r.area === f.area) &&
      (!q || r.key.toLowerCase().includes(q) || flat(r.english).toLowerCase().includes(q) || flat(r.text).toLowerCase().includes(q)),
  );
}
