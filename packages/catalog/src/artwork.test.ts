import { describe, expect, it } from 'vitest';
import { artworkFromRow } from './artwork';

const row = {
  poster_id: 'a1',
  poster_alt: null,
  poster_color: '#336699',
  poster_width: 1600,
  poster_height: 900,
  poster_variants: [
    { width: 640, height: 360, key: 'img/a1/640-aa.jpg', bytes: 1, format: 'jpeg' as const },
    { width: 320, height: 180, key: 'img/a1/320-bb.webp', bytes: 1, format: 'webp' as const },
    { width: 320, height: 180, key: 'img/a1/320-cc.jpg', bytes: 1, format: 'jpeg' as const },
    { width: 640, height: 360, key: 'img/a1/640-dd.webp', bytes: 1, format: 'webp' as const },
    { width: 960, height: 540, key: 'img/old/960-ee.webp', bytes: 1 },
  ],
};

describe('artworkFromRow avif and blur', () => {
  it('keeps avif variants with their format and passes the blur placeholder through', () => {
    const art = artworkFromRow(
      {
        ...row,
        poster_blur: 'data:image/webp;base64,AAAA',
        poster_variants: [
          { width: 320, height: 180, key: 'img/a1/320-aa.avif', bytes: 1, format: 'avif' as const },
          { width: 320, height: 180, key: 'img/a1/320-bb.webp', bytes: 1, format: 'webp' as const },
        ],
      },
      'https://m.test/',
    )!;
    expect(art.variants.map((v) => v.format)).toEqual(['avif', 'webp']);
    expect(art.placeholderBlur).toBe('data:image/webp;base64,AAAA');
  });
  it('has no blur on rows made before it existed', () => {
    expect(artworkFromRow(row, 'https://m.test/')!.placeholderBlur).toBeNull();
  });
});

describe('artworkFromRow formats', () => {
  it('keeps the format on every variant and sorts by width then format', () => {
    const art = artworkFromRow(row, 'https://m.test/')!;
    expect(art.variants.map((v) => `${v.width}:${v.format ?? 'webp'}`)).toEqual([
      '320:jpeg',
      '320:webp',
      '640:jpeg',
      '640:webp',
      '960:webp',
    ]);
    expect(art.variants[1]!.url).toBe('https://m.test/img/a1/320-bb.webp');
  });
});

describe('artworkFromRow full picture preview', () => {
  it('never offers the admin only full picture preview to the viewer', () => {
    const art = artworkFromRow(
      {
        ...row,
        poster_variants: [
          { width: 320, height: 180, key: 'img/a1/320-bb.webp', bytes: 1, format: 'webp' as const },
          {
            width: 320,
            height: 320,
            key: 'img/a1/full-zz.webp',
            bytes: 1,
            format: 'webp' as const,
            full: true,
          },
        ],
      },
      'https://m.test/',
    )!;
    expect(art.variants.map((v) => v.url)).toEqual(['https://m.test/img/a1/320-bb.webp']);
  });
});
