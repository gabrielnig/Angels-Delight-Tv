import { describe, expect, it } from 'vitest';
import { PLATFORM_LIMITS, previewCards, shareTextOf, validateShareText } from './share-overrides';

describe('validateShareText', () => {
  it('trims, turns empty into null and keeps quotes and diacritics', () => {
    expect(validateShareText({ title: '  Ìgbà "Ọ̀rọ̀"  ', description: '' })).toEqual({
      ok: true,
      value: { shareTitle: 'Ìgbà "Ọ̀rọ̀"', shareDescription: null },
    });
  });
  it('only touches the fields it is given', () => {
    expect(validateShareText({ title: 'A' })).toEqual({ ok: true, value: { shareTitle: 'A' } });
  });
  it('refuses a long title, a long description, markup and control characters with plain messages', () => {
    const r = validateShareText({ title: 'x'.repeat(91), description: 'y'.repeat(201) });
    expect(r).toMatchObject({ ok: false, errors: { title: expect.stringContaining('90'), description: expect.stringContaining('200') } });
    expect(validateShareText({ title: '<b>x</b>' })).toMatchObject({ ok: false, errors: { title: expect.any(String) } });
    expect(validateShareText({ description: 'a\u0000b' })).toMatchObject({ ok: false, errors: { description: expect.any(String) } });
  });
});

describe('shareTextOf', () => {
  it('uses the share words when set, the title and description otherwise', () => {
    expect(shareTextOf({ title: 'T', description: 'D' }, { title: 'S', description: null })).toEqual({ title: 'S', description: 'D' });
    expect(shareTextOf({ title: 'T', description: 'D' }, undefined)).toEqual({ title: 'T', description: 'D' });
    expect(shareTextOf({ title: 'T', description: 'D' }, { title: ' ', description: ' ' })).toEqual({ title: 'T', description: 'D' });
  });
});

describe('previewCards', () => {
  const long = 'Rivers carry water and stories across the land. '.repeat(10);
  it('makes a card per platform, trimmed to what that platform shows, with the domain', () => {
    const cards = previewCards({ title: long, description: long, siteName: 'Test TV', origin: 'https://learn.example.ng', imageUrl: '/og/title/a?v=1' });
    expect(cards.map((c) => c.platform)).toEqual(['whatsapp', 'facebook', 'x']);
    for (const card of cards) {
      expect(card.title.length).toBeLessThanOrEqual(PLATFORM_LIMITS[card.platform].title);
      expect(card.description.length).toBeLessThanOrEqual(PLATFORM_LIMITS[card.platform].description);
      expect(card.domain).toBe('learn.example.ng');
      expect(card.imageUrl).toBe('https://learn.example.ng/og/title/a?v=1');
    }
  });
  it('shows the title and warns when text will be cut', () => {
    const [wa] = previewCards({ title: long, description: 'short', siteName: 'S', origin: 'https://e.test', imageUrl: null });
    expect(wa!.cut).toEqual({ title: true, description: false });
    expect(wa!.imageUrl).toBeNull();
  });
  it('works without an origin by showing the site name as the domain', () => {
    const [, fb] = previewCards({ title: 'T', description: 'D', siteName: 'Test TV', origin: undefined, imageUrl: null });
    expect(fb!.domain).toBe('Test TV');
  });
});
