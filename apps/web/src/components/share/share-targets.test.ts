import { describe, expect, it } from 'vitest';
import {
  SHARE_TARGET_IDS,
  canonicalShareUrl,
  clampShareText,
  sheetTargets,
  targetHref,
} from './share-targets';

const url = 'https://e.test/title/rivers';
const base = { title: 'Rivers', text: 'Rivers on ADTV', url };

describe('share target links (L15a slice 1)', () => {
  it('lists the eight places in the order the owner asked for', () => {
    expect(SHARE_TARGET_IDS).toEqual([
      'copy', 'whatsapp', 'facebook', 'x', 'telegram', 'email', 'sms', 'more',
    ]);
  });

  it('builds a link for every channel with the clean url and no tag', () => {
    const enc = encodeURIComponent;
    expect(targetHref('whatsapp', base)).toBe(`https://wa.me/?text=${enc(`Rivers on ADTV ${url}`)}`);
    expect(targetHref('facebook', base)).toBe(
      `https://www.facebook.com/sharer/sharer.php?u=${enc(url)}`,
    );
    expect(targetHref('x', base)).toBe(
      `https://x.com/intent/post?text=${enc('Rivers on ADTV')}&url=${enc(url)}`,
    );
    expect(targetHref('telegram', base)).toBe(
      `https://t.me/share/url?url=${enc(url)}&text=${enc('Rivers on ADTV')}`,
    );
    expect(targetHref('email', base)).toBe(
      `mailto:?subject=Rivers&body=${enc(`Rivers on ADTV\n${url}`)}`,
    );
    expect(targetHref('sms', base)).toBe(`sms:?&body=${enc(`Rivers on ADTV ${url}`)}`);
    for (const id of ['whatsapp', 'facebook', 'x', 'telegram', 'email', 'sms'] as const) {
      expect(targetHref(id, base)).not.toContain('s%3D');
      expect(targetHref(id, base)).not.toContain('?s=');
    }
  });

  it('escapes ampersands, hashes, quotes, brackets and spaces in titles', () => {
    const input = { title: `A & B #1 (it's!)`, text: `A & B #1 (it's!)`, url };
    for (const id of ['whatsapp', 'x', 'telegram', 'email', 'sms'] as const) {
      const href = targetHref(id, input);
      expect(/[ '()!#]/.test(href.slice(href.indexOf('?') + 1))).toBe(false);
      expect(href).toContain('%26');
      expect(href).toContain('%23');
      expect(href).toContain('%27');
      expect(href).toContain('%21');
      expect(href).not.toContain('A & B');
    }
  });

  it('keeps Yoruba, Igbo and Hausa letters intact when decoded', () => {
    const title = 'Ìtàn Ọ̀rọ̀ Ṣé ụlọ akwụkwọ ƙasa ɗan';
    const href = targetHref('telegram', { title, text: title, url });
    expect(decodeURIComponent(href.split('&text=')[1] as string)).toBe(title);
    expect(href).not.toMatch(/[^\x20-\x7e]/);
  });

  it('cuts very long text so a link stays short enough to open', () => {
    const long = 'Word '.repeat(200).trim();
    const text = clampShareText(long, 200);
    expect(text.length).toBeLessThanOrEqual(200);
    expect(text.endsWith('...')).toBe(true);
    expect(clampShareText('Short', 200)).toBe('Short');
    expect(targetHref('x', { title: long, text: long, url }).length).toBeLessThan(900);
    expect(decodeURIComponent(targetHref('x', { title: long, text: long, url }))).toContain(url);
  });

  it('does not cut in the middle of a letter with a mark', () => {
    const text = clampShareText('a' + '̀'.repeat(10) + 'b'.repeat(300), 20);
    expect(text).not.toMatch(/̀\.\.\.$/);
    expect(text.length).toBeLessThanOrEqual(20);
  });
});

describe('sheet target list', () => {
  const all = ['whatsapp', 'facebook', 'x', 'telegram', 'email', 'sms'] as const;

  it('puts Copy link first and More last when the device can share', () => {
    expect(sheetTargets([...all], { nativeShare: true })).toEqual([
      'copy', 'whatsapp', 'facebook', 'x', 'telegram', 'email', 'sms', 'more',
    ]);
  });

  it('hides More when the device has no share menu', () => {
    expect(sheetTargets([...all], { nativeShare: false }).includes('more')).toBe(false);
  });

  it('follows the admin order and leaves out what is switched off', () => {
    expect(sheetTargets(['telegram', 'whatsapp'], { nativeShare: false })).toEqual([
      'copy', 'telegram', 'whatsapp',
    ]);
  });

  it('ignores unknown and repeated ids', () => {
    expect(
      sheetTargets(['x', 'x', 'myspace', 'copy', 'more'] as never, { nativeShare: false }),
    ).toEqual(['copy', 'x']);
  });
});

describe('canonical share url', () => {
  const origin = 'https://adtv.example';

  it('builds the clean public address for a video and a series', () => {
    expect(canonicalShareUrl({ origin, kind: 'video', slug: 'how-rain-forms' })).toBe(
      'https://adtv.example/title/how-rain-forms',
    );
    expect(canonicalShareUrl({ origin, kind: 'series', slug: 'science-p4' })).toBe(
      'https://adtv.example/series/science-p4',
    );
  });

  it('drops a trailing slash on the origin and encodes the slug', () => {
    expect(canonicalShareUrl({ origin: `${origin}/`, kind: 'video', slug: 'a b' })).toBe(
      'https://adtv.example/title/a%20b',
    );
  });

  it('adds only a whole second start time for videos', () => {
    expect(canonicalShareUrl({ origin, kind: 'video', slug: 's', startAt: 83.9 })).toBe(
      'https://adtv.example/title/s?t=83',
    );
    expect(canonicalShareUrl({ origin, kind: 'video', slug: 's', startAt: 0 })).toBe(
      'https://adtv.example/title/s',
    );
    expect(canonicalShareUrl({ origin, kind: 'video', slug: 's', startAt: -4 })).toBe(
      'https://adtv.example/title/s',
    );
    expect(canonicalShareUrl({ origin, kind: 'series', slug: 's', startAt: 90 })).toBe(
      'https://adtv.example/series/s',
    );
  });

  it('refuses an origin that is not https outside local development', () => {
    expect(() => canonicalShareUrl({ origin: 'http://adtv.example', kind: 'video', slug: 's' })).toThrow();
    expect(canonicalShareUrl({ origin: 'http://localhost:3000', kind: 'video', slug: 's' })).toBe(
      'http://localhost:3000/title/s',
    );
  });
});
