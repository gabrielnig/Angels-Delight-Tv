import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { gzipSync } from 'node:zlib';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/font/local', () => ({
  default: (options: { src: { path: string }[]; preload?: boolean }) => {
    const file = options.src[0]!.path.split('/').pop()!.replace('.woff2', '');
    return {
      className: `cls-${file}${options.preload === false ? '-lazy' : ''}`,
      style: { fontFamily: `'${file}'` },
    };
  },
}));

import { FONT_KEYS } from '@ad/ui';
import { selectFonts } from '../fonts';
import {
  PERF_BUDGET,
  fontPreloadsFromHtml,
  fontViolations,
  imageViolations,
  jsViolations,
  parseImages,
  routeSizesFromManifest,
} from './budget';

describe('performance budget (M45-S13)', () => {
  it('holds the numbers from the story', () => {
    expect(PERF_BUDGET).toEqual({
      jsGzipBytesPerRoute: 170 * 1024,
      lcpMs: 2500,
      cls: 0.1,
      inpMs: 200,
      maxPreloadedFonts: 4,
      maxFontFamilies: 2,
    });
  });

  it('fails when a route exceeds the js budget and names the route and sizes', () => {
    const v = jsViolations([
      { route: '/', gzipBytes: 160 * 1024 },
      { route: '/search', gzipBytes: 171 * 1024 },
    ]);
    expect(v).toHaveLength(1);
    expect(v[0]).toContain('/search');
    expect(v[0]).toContain('171');
    expect(jsViolations([{ route: '/', gzipBytes: 170 * 1024 }])).toEqual([]);
  });

  it('fails when an image has no dimensions and passes width and height or an aspect ratio', () => {
    const bad = imageViolations(parseImages('<img src="/a.jpg" alt="" loading="lazy">'));
    expect(bad).toHaveLength(1);
    expect(bad[0]).toMatch(/no width and height/);
    expect(imageViolations(parseImages('<img src="/a.jpg" width="640" height="360" loading="lazy">'))).toEqual([]);
    expect(imageViolations(parseImages('<img src="/a.jpg" style="aspect-ratio:16/9" loading="lazy">'))).toEqual([]);
    expect(imageViolations(parseImages('<img src="/a.jpg" width="640" loading="lazy">'))).toHaveLength(1);
  });

  it('fails when the hero image is lazy and passes an eager one with high priority', () => {
    const lazy = parseImages('<img data-hero="true" src="/h.jpg" width="1600" height="900" loading="lazy">');
    expect(imageViolations(lazy).join()).toMatch(/hero/i);
    const ok = parseImages('<img data-hero="true" src="/h.jpg" width="1600" height="900" loading="eager" fetchpriority="high">');
    expect(imageViolations(ok)).toEqual([]);
    const noPriority = parseImages('<img data-hero="true" src="/h.jpg" width="1600" height="900" loading="eager">');
    expect(imageViolations(noPriority).join()).toMatch(/fetchpriority/i);
  });

  it('wants every image below the first to load lazily', () => {
    const eagerCard = parseImages('<img src="/c.jpg" width="640" height="360">');
    expect(imageViolations(eagerCard).join()).toMatch(/lazy/i);
    expect(imageViolations(parseImages('<img src="/c.jpg" width="640" height="360" loading="lazy">'))).toEqual([]);
  });

  it('reads attributes in any order and ignores other tags', () => {
    const images = parseImages('<picture><source srcset="/a.webp"><img height="9" alt="x" loading=lazy width=16 src="/a.jpg"></picture><p width="1">');
    expect(images).toHaveLength(1);
    expect(images[0]).toMatchObject({ width: '16', height: '9', loading: 'lazy' });
  });

  it('fails when more than four font files are preloaded or more than two families are used', () => {
    expect(fontViolations({ preloaded: 4, families: 2 })).toEqual([]);
    expect(fontViolations({ preloaded: 5, families: 2 }).join()).toMatch(/preloaded/);
    expect(fontViolations({ preloaded: 2, families: 3 }).join()).toMatch(/famil/);
  });

  it('lists the font files a page preloads', () => {
    const html =
      '<link rel="preload" href="/fonts/inter-latin-wght-normal.woff2" as="font" type="font/woff2" crossorigin="">' +
      '<link rel="stylesheet" href="/a.css"><link rel="preload" as="font" href="/fonts/dm-sans-latin-wght-normal.woff2">' +
      '<link rel="preload" as="image" href="/hero.jpg">';
    const found = fontPreloadsFromHtml(html);
    expect(found.files).toEqual(['/fonts/inter-latin-wght-normal.woff2', '/fonts/dm-sans-latin-wght-normal.woff2']);
    expect(found.families).toHaveLength(2);
  });

  it('preloads at most four font files for every theme font and language', () => {
    for (const key of FONT_KEYS) {
      for (const lang of ['en', 'yo', 'ig', 'ha', 'pcm']) {
        const { classNames } = selectFonts(key, lang);
        const preloaded = classNames.split(' ').filter((c) => c && !c.endsWith('-lazy')).length;
        expect(preloaded, `${key} ${lang}`).toBeLessThanOrEqual(PERF_BUDGET.maxPreloadedFonts);
      }
    }
  });

  it('adds up each route from its unique files and gzips them', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ad-perf-'));
    mkdirSync(join(dir, 'static/chunks'), { recursive: true });
    const body = 'x'.repeat(50_000);
    writeFileSync(join(dir, 'static/chunks/shared.js'), body);
    writeFileSync(join(dir, 'static/chunks/page.js'), body + 'y');
    writeFileSync(join(dir, 'static/chunks/styles.css'), body);
    writeFileSync(
      join(dir, 'app-build-manifest.json'),
      JSON.stringify({
        pages: {
          '/page': ['static/chunks/shared.js', 'static/chunks/page.js', 'static/chunks/shared.js', 'static/chunks/styles.css'],
          '/layout': ['static/chunks/shared.js'],
        },
      }),
    );
    const sizes = routeSizesFromManifest(dir);
    const page = sizes.find((s) => s.route === '/page')!;
    expect(page.gzipBytes).toBe(
      gzipSync(Buffer.from(body)).length + gzipSync(Buffer.from(body + 'y')).length,
    );
    expect(sizes.map((s) => s.route)).toContain('/layout');
  });

  const build = resolve(__dirname, '../../../.next');
  it.skipIf(!existsSync(join(build, 'app-build-manifest.json')))('passes the current build manifest', () => {
    expect(jsViolations(routeSizesFromManifest(build))).toEqual([]);
  });
});
