import { describe, expect, it } from 'vitest';
import {
  FIXTURES,
  checkImage,
  checkPage,
  imageSize,
  parseHead,
  type ImageFetch,
} from './share-check';

const jpeg = (w: number, h: number) =>
  Buffer.from([0xff, 0xd8, 0xff, 0xc0, 0x00, 0x11, 0x08, h >> 8, h & 255, w >> 8, w & 255, 3, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1]);
const png = (w: number, h: number) => {
  const b = Buffer.alloc(33);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(b);
  b.writeUInt32BE(13, 8);
  b.write('IHDR', 12);
  b.writeUInt32BE(w, 16);
  b.writeUInt32BE(h, 20);
  return b;
};

describe('imageSize', () => {
  it('reads jpeg and png headers, and refuses other bytes', () => {
    expect(imageSize(jpeg(1200, 630))).toEqual({ width: 1200, height: 630, type: 'image/jpeg' });
    expect(imageSize(png(1200, 630))).toEqual({ width: 1200, height: 630, type: 'image/png' });
    expect(imageSize(Buffer.from('<html>'))).toBeNull();
  });
});

describe('parseHead', () => {
  it('reads property and name metas, the canonical link and the robots meta, in any attribute order', () => {
    const tags = parseHead(
      `<head><meta property="og:title" content="A &amp; B"/><meta content="x" name="twitter:card">` +
        `<link href="https://e.test/a" rel="canonical"/><meta name="robots" content="noindex, follow"></head>`,
    );
    expect(tags.meta.get('og:title')).toEqual(['A & B']);
    expect(tags.meta.get('twitter:card')).toEqual(['x']);
    expect(tags.canonical).toBe('https://e.test/a');
    expect(tags.robots).toBe('noindex, follow');
  });
});

describe('checkPage', () => {
  it('passes the good video fixture', () => {
    expect(checkPage(FIXTURES.goodVideo.html, FIXTURES.goodVideo.url, { kind: 'video' })).toEqual([]);
  });
  it('passes the good series fixture', () => {
    expect(checkPage(FIXTURES.goodSeries.html, FIXTURES.goodSeries.url, { kind: 'series' })).toEqual([]);
  });
  it('flags every required tag that is missing', () => {
    const issues = checkPage('<head><title>x</title></head>', 'https://e.test/x', { kind: 'website' });
    for (const tag of ['og:title', 'og:type', 'og:image', 'og:url', 'og:site_name', 'og:description', 'og:locale', 'twitter:card', 'twitter:image:alt', 'canonical']) {
      expect(issues.join('\n'), tag).toContain(tag);
    }
  });
  it('flags a canonical that differs from og:url, a relative image and a wrong type', () => {
    const issues = checkPage(FIXTURES.badVideo.html, FIXTURES.badVideo.url, { kind: 'video' });
    const text = issues.join('\n');
    expect(text).toContain('canonical');
    expect(text).toContain('og:image must be an absolute https url');
    expect(text).toContain('og:type should be video.other');
    expect(text).toContain('og:video');
  });
  it('allows http only with the flag', () => {
    const http = FIXTURES.goodVideo.html.replaceAll('https://', 'http://');
    expect(checkPage(http, 'http://e.test/title/rivers', { kind: 'video' }).join()).toContain('https');
    expect(checkPage(http, 'http://e.test/title/rivers', { kind: 'video', allowHttp: true })).toEqual([]);
  });
  it('accepts a private page that is noindex and rejects one that is not', () => {
    expect(checkPage('<head><meta name="robots" content="noindex"></head>', 'https://e.test/search', { kind: 'private' })).toEqual([]);
    expect(checkPage('<head></head>', 'https://e.test/search', { kind: 'private' }).join()).toContain('noindex');
  });
  it('flags markup inside a tag value and an over long description', () => {
    const bad = FIXTURES.goodVideo.html
      .replaceAll('A film about rivers.', '&lt;script&gt;x&lt;/script&gt;' + 'word '.repeat(60));
    const text = checkPage(bad, FIXTURES.goodVideo.url, { kind: 'video' }).join('\n');
    expect(text).toContain('markup');
    expect(text).toContain('og:description is longer');
  });
});

const ok: ImageFetch = { status: 200, redirected: false, contentType: 'image/jpeg', bytes: jpeg(1200, 630), ms: 120, length: 90_000 };

describe('checkImage', () => {
  const declared = { width: 1200, height: 630, type: 'image/jpeg' };
  it('passes a good image', () => {
    expect(checkImage(ok, declared)).toEqual([]);
  });
  it('flags status, redirect, content type, size, dimensions, mismatch and time', () => {
    const text = checkImage(
      { ...ok, status: 302, redirected: true, contentType: 'text/html', length: 400_000, bytes: jpeg(500, 200), ms: 5000 },
      declared,
    ).join('\n');
    for (const word of ['status', 'redirect', 'content type', '300 KB', '600 by 315', 'declared', 'slow']) {
      expect(text, word).toContain(word);
    }
  });
});
