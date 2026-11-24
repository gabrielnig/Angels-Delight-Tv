/**
 * Sample draft catalogs for Yoruba, Igbo and Hausa. They were written without a native speaker, so each file says
 * `status: draft`, `reviewed: false` and has no reviewer. They are not baselines: nothing here reaches a viewer.
 * An editor loads them into the translation workspace as draft rows (`TranslationService.loadDrafts`), where a
 * native reviewer edits and an Admin approves each line (decision D-345).
 */
import ha from './drafts/ha.json';
import ig from './drafts/ig.json';
import yo from './drafts/yo.json';
import type { CatalogShape } from './messages';

export interface DraftCatalog {
  status: 'draft';
  reviewed: false;
  reviewer: null;
  note: string;
  entries: CatalogShape;
}

export const DRAFT_CATALOGS: Record<'yo' | 'ig' | 'ha', DraftCatalog> = {
  yo: yo as DraftCatalog,
  ig: ig as DraftCatalog,
  ha: ha as DraftCatalog,
};

export const DRAFT_LOCALES = ['yo', 'ig', 'ha'] as const;

/** The draft text for a locale, or nothing when there is no draft. */
export function draftEntries(locale: string): CatalogShape {
  return (DRAFT_CATALOGS as Record<string, DraftCatalog | undefined>)[locale]?.entries ?? {};
}
