import { createHash } from 'node:crypto';
import {
  pluralCategoriesFor,
  type CatalogShape,
  type MessageText,
} from '@ad/shared/messages';

export type RowStatus = 'draft' | 'in_review' | 'approved';

export interface TranslationRow {
  key: string;
  status: RowStatus;
  text: MessageText;
  /** sha256 hex of the English text when this row was translated. */
  sourceHash: string | null;
  note?: string | null;
  updatedBy?: string | null;
  reviewedBy?: string | null;
  reviewedAt?: Date | null;
  updatedAt: Date;
}

/** Key prefixes that must be translated before a language can go live (shell, auth, player, account and the chrome). */
export const CORE_PREFIXES = ['nav', 'auth', 'player', 'account', 'guest', 'kidsExit', 'language', 'profile', 'home'] as const;

export function isCoreKey(key: string): boolean {
  return (CORE_PREFIXES as readonly string[]).includes(key.split('.')[0] ?? '');
}

/** Stable hash of an English text (a string or plural object) to spot a changed source. */
export function hashText(text: MessageText): string {
  const canonical =
    typeof text === 'string'
      ? text
      : JSON.stringify(Object.fromEntries(Object.entries(text).sort(([a], [b]) => a.localeCompare(b))));
  return createHash('sha256').update(canonical.normalize('NFC')).digest('hex');
}

function pluralComplete(locale: string, english: MessageText, text: MessageText): boolean {
  if (typeof english === 'string') return typeof text === 'string' && text.trim().length > 0;
  if (typeof text === 'string') return false;
  const forms = text as Record<string, string | undefined>;
  return pluralCategoriesFor(locale).every((c) => Boolean(forms[c]?.trim()));
}

export interface Summary {
  total: number;
  coreTotal: number;
  coreApproved: number;
  approvedPercent: number;
  approved: string[];
  inReview: string[];
  drafts: string[];
  stale: string[];
  missing: string[];
}

export function summarize(input: {
  locale: string;
  english: CatalogShape;
  baseline: CatalogShape;
  rows: readonly TranslationRow[];
}): Summary {
  const byKey = new Map(input.rows.map((r) => [r.key, r]));
  const out: Summary = {
    total: 0, coreTotal: 0, coreApproved: 0, approvedPercent: 0,
    approved: [], inReview: [], drafts: [], stale: [], missing: [],
  };
  for (const [key, english] of Object.entries(input.english)) {
    out.total++;
    const core = isCoreKey(key);
    if (core) out.coreTotal++;
    const row = byKey.get(key);
    let approved = false;
    if (row) {
      if (row.sourceHash && row.sourceHash !== hashText(english)) out.stale.push(key);
      if (row.status === 'approved' && pluralComplete(input.locale, english, row.text)) {
        out.approved.push(key);
        approved = true;
      } else if (row.status === 'in_review') out.inReview.push(key);
      else out.drafts.push(key);
    } else if (input.baseline[key] !== undefined) {
      out.approved.push(key);
      approved = true;
    } else {
      out.missing.push(key);
    }
    if (core && approved) out.coreApproved++;
  }
  out.approvedPercent = out.coreTotal === 0 ? 100 : Math.round((out.coreApproved / out.coreTotal) * 100);
  return out;
}
