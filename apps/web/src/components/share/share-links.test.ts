import { describe, expect, it } from 'vitest';
import { CHANNEL_TAGS, shareHref, withChannelTag } from './share-links';

const url = 'https://e.test/title/rivers';

describe('share links (M45-S06)', () => {
  it('builds a whatsapp link with encoded text and url', () => {
    const href = shareHref('whatsapp', { title: 'Rivers', text: 'Rivers on ADTV', url });
    expect(href).toBe(
      `https://wa.me/?text=${encodeURIComponent(`Rivers on ADTV ${withChannelTag(url, 'wa')}`)}`,
    );
  });

  it('appends the channel tag only once', () => {
    expect(withChannelTag(url, 'wa')).toBe(`${url}?s=wa`);
    expect(withChannelTag(`${url}?s=fb`, 'wa')).toBe(`${url}?s=wa`);
    expect(withChannelTag(`${url}?season=2`, 'x')).toBe(`${url}?season=2&s=x`);
    expect(withChannelTag(withChannelTag(url, 'wa'), 'wa')).toBe(`${url}?s=wa`);
  });

  it('escapes ampersands and hashes in titles', () => {
    const href = shareHref('whatsapp', { title: 'A & B #1', text: 'A & B #1 on ADTV', url });
    expect(href).toContain('A%20%26%20B%20%231');
    expect(href).not.toContain('A & B');
  });

  it('builds facebook, x and email links', () => {
    const input = { title: 'Rivers', text: 'Rivers on ADTV', url };
    expect(shareHref('facebook', input)).toBe(
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(`${url}?s=fb`)}`,
    );
    expect(shareHref('x', input)).toBe(
      `https://x.com/intent/post?text=${encodeURIComponent('Rivers on ADTV')}&url=${encodeURIComponent(`${url}?s=x`)}`,
    );
    const mail = shareHref('email', input);
    expect(mail.startsWith('mailto:?subject=Rivers&body=')).toBe(true);
    expect(mail).toContain(encodeURIComponent(`${url}?s=em`));
  });

  it('names a tag for every channel and for copy', () => {
    expect(CHANNEL_TAGS).toMatchObject({
      whatsapp: 'wa',
      facebook: 'fb',
      x: 'x',
      email: 'em',
      copy: 'cp',
    });
  });
});
