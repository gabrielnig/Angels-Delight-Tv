import { describe, expect, it } from 'vitest';
import { BASELINES } from './catalogs';
import { DRAFT_CATALOGS, DRAFT_LOCALES, draftEntries } from './drafts';
import { EN_NG } from './en-ng';
import { effectiveCatalog } from './merge';
import type { MessageText } from './messages';
import { validateTranslation } from './validate';

const english = EN_NG as unknown as Record<string, MessageText>;

describe('sample draft catalogs (M46, pending native review)', () => {
  it('exist for Yoruba, Igbo and Hausa only', () => {
    expect([...DRAFT_LOCALES].sort()).toEqual(['ha', 'ig', 'yo']);
  });

  it.each(DRAFT_LOCALES)('%s is marked draft, not reviewed, with no reviewer', (locale) => {
    const draft = DRAFT_CATALOGS[locale];
    expect(draft.status).toBe('draft');
    expect(draft.reviewed).toBe(false);
    expect(draft.reviewer).toBeNull();
    expect(draft.note).toMatch(/native/i);
    expect(Object.keys(draft.entries).length).toBeGreaterThan(20);
  });

  it.each(DRAFT_LOCALES)('%s only uses English keys and passes validation', (locale) => {
    const bad = Object.entries(draftEntries(locale)).flatMap(([key, text]) => {
      if (!(key in english)) return [`${key}: unknown key`];
      return validateTranslation({ locale, english: english[key]!, text }).errors.map(
        (e) => `${key}: ${e}`,
      );
    });
    expect(bad).toEqual([]);
  });

  it.each(DRAFT_LOCALES)(
    '%s drafts never reach viewers through the baseline or the effective catalog',
    (locale) => {
      expect(Object.keys(BASELINES[locale])).toEqual([]);
      expect(Object.keys(effectiveCatalog(BASELINES[locale], new Map()))).toEqual([]);
      const row = new Map([['nav.home', { status: 'draft' as const, text: 'x' }]]);
      expect(effectiveCatalog(BASELINES[locale], row)['nav.home']).toBeUndefined();
    },
  );

  it('draftEntries is empty for locales without a draft', () => {
    expect(draftEntries('pcm')).toEqual({});
    expect(draftEntries('en')).toEqual({});
  });
});
