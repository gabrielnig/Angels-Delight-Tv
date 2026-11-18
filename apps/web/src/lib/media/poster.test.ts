import { describe, expect, it } from 'vitest';
import { buildPosterSources, type PosterVariant } from './poster';

const variants: PosterVariant[] = [
  { width: 960, height: 540, url: 'https://m.example/img/a/960-aaaa1111.webp' },
  { width: 320, height: 180, url: 'https://m.example/img/a/320-bbbb2222.webp' },
  { width: 640, height: 360, url: 'https://m.example/img/a/640-cccc3333.webp' },
  { width: 480, height: 270, url: 'https://m.example/img/a/480-dddd4444.webp' },
];

describe('buildPosterSources', () => {
  it('builds a width descriptor srcset sorted ascending', () => {
    const out = buildPosterSources(variants, {})!;
    expect(out.srcSet).toBe(
      [
        'https://m.example/img/a/320-bbbb2222.webp 320w',
        'https://m.example/img/a/480-dddd4444.webp 480w',
        'https://m.example/img/a/640-cccc3333.webp 640w',
        'https://m.example/img/a/960-aaaa1111.webp 960w',
      ].join(', '),
    );
  });

  it('uses a middle variant as the fallback src and reports its size for layout', () => {
    const out = buildPosterSources(variants, {})!;
    expect(out.src).toContain('480-');
    expect(out).toMatchObject({ width: 480, height: 270 });
  });

  it('never offers a variant wider than the Data saver cap (M25-S03 AC1)', () => {
    const out = buildPosterSources(variants, { maxWidth: 320 })!;
    expect(out.srcSet).toBe('https://m.example/img/a/320-bbbb2222.webp 320w');
    expect(out.src).toContain('320-');
  });

  it('falls back to the smallest variant when all are wider than the cap', () => {
    const out = buildPosterSources(
      variants.filter((v) => v.width >= 480),
      { maxWidth: 320 },
    )!;
    expect(out.srcSet).toBe('https://m.example/img/a/480-dddd4444.webp 480w');
  });

  it('returns null with no variants so the caller shows a placeholder', () => {
    expect(buildPosterSources([], {})).toBeNull();
  });

  it('drops variants with unusable sizes or urls', () => {
    const out = buildPosterSources(
      [
        { width: 0, height: 0, url: 'x' },
        { width: 320, height: 180, url: '' },
      ],
      {},
    );
    expect(out).toBeNull();
  });
});

describe('buildPosterSources with formats', () => {
  const mixed: PosterVariant[] = [
    { width: 320, height: 180, url: 'a320.webp', format: 'webp' },
    { width: 320, height: 180, url: 'a320.jpg', format: 'jpeg' },
    { width: 640, height: 360, url: 'a640.webp', format: 'webp' },
    { width: 640, height: 360, url: 'a640.jpg', format: 'jpeg' },
  ];
  it('keeps webp in the main set and puts jpeg in the fallback set', () => {
    const out = buildPosterSources(mixed, {})!;
    expect(out.srcSet).toBe('a320.webp 320w, a640.webp 640w');
    expect(out.fallback).toEqual({ src: 'a320.jpg', srcSet: 'a320.jpg 320w, a640.jpg 640w' });
  });
  it('applies the Data saver cap to both sets', () => {
    const out = buildPosterSources(mixed, { maxWidth: 320 })!;
    expect(out.srcSet).toBe('a320.webp 320w');
    expect(out.fallback?.srcSet).toBe('a320.jpg 320w');
  });
  it('uses jpeg alone when there is no webp', () => {
    const out = buildPosterSources(mixed.filter((v) => v.format === 'jpeg'), {})!;
    expect(out.srcSet).toBe('a320.jpg 320w, a640.jpg 640w');
    expect(out.fallback).toBeUndefined();
  });
});
