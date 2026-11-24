import { describe, expect, it } from 'vitest';
import { hashText, summarize, type TranslationRow } from './status';

const english = {
  'nav.home': 'Home',
  'nav.browse': 'Browse',
  'player.play': 'Play',
  'misc.thing': 'Thing',
  'player.count': { one: '{count} video', other: '{count} videos' },
} as never;

const row = (key: string, status: TranslationRow['status'], text: TranslationRow['text'], en: unknown = (english as Record<string, unknown>)[key]): TranslationRow => ({
  key,
  status,
  text,
  sourceHash: hashText(en as never),
  updatedAt: new Date(0),
});

describe('summarize', () => {
  it('approved percent counts core keys only', () => {
    const s = summarize({
      locale: 'yo',
      english,
      baseline: {},
      rows: [row('nav.home', 'approved', 'Ilé'), row('misc.thing', 'approved', 'Nkan')],
    });
    // core keys: nav.home, nav.browse, player.play, player.count. One approved.
    expect(s.coreTotal).toBe(4);
    expect(s.coreApproved).toBe(1);
    expect(s.approvedPercent).toBe(25);
  });
  it('stale keys are those whose source_hash differs from the English hash', () => {
    const s = summarize({
      locale: 'yo',
      english,
      baseline: {},
      rows: [row('nav.home', 'approved', 'Ilé', 'Old English')],
    });
    expect(s.stale).toEqual(['nav.home']);
  });
  it('missing keys exclude approved and draft', () => {
    const s = summarize({
      locale: 'yo',
      english,
      baseline: { 'nav.browse': 'Wá' },
      rows: [row('nav.home', 'draft', 'Ilé'), row('player.play', 'approved', 'Ṣe')],
    });
    expect(s.missing).toEqual(['misc.thing', 'player.count']);
  });
  it('plural keys need every category to count as approved', () => {
    const incomplete = summarize({
      locale: 'ha',
      english,
      baseline: {},
      rows: [row('player.count', 'approved', { other: '{count} bidiyo' } as never)],
    });
    expect(incomplete.coreApproved).toBe(0);
    const complete = summarize({
      locale: 'ha',
      english,
      baseline: {},
      rows: [row('player.count', 'approved', { one: '{count} bidiyo', other: '{count} bidiyo' } as never)],
    });
    expect(complete.coreApproved).toBe(1);
  });
  it('counts in review and approved rows', () => {
    const s = summarize({
      locale: 'yo',
      english,
      baseline: {},
      rows: [row('nav.home', 'in_review', 'Ilé'), row('player.play', 'approved', 'Ṣe')],
    });
    expect(s.inReview).toEqual(['nav.home']);
    expect(s.approved).toContain('player.play');
  });
  it('baseline text counts as approved', () => {
    const s = summarize({ locale: 'yo', english, baseline: { 'nav.home': 'Ilé' }, rows: [] });
    expect(s.approved).toEqual(['nav.home']);
  });
});
