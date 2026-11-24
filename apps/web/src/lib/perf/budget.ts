import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

/**
 * Performance budget (M45-S13). Numbers are for a Moto G class phone on throttled 4G. LCP, CLS and INP are measured
 * in the browser (Lighthouse CI or the real user vitals); the rest are checked from the build output and the page
 * HTML by `scripts/perf-budget.ts`. Budgets live here and nowhere else.
 */
export const PERF_BUDGET = {
  /** First load JavaScript per route, gzip. */
  jsGzipBytesPerRoute: 170 * 1024,
  lcpMs: 2500,
  cls: 0.1,
  inpMs: 200,
  maxPreloadedFonts: 4,
  maxFontFamilies: 2,
} as const;

export interface RouteSize {
  route: string;
  gzipBytes: number;
}

const kb = (bytes: number) => (bytes / 1024).toFixed(1);

export function jsViolations(routes: readonly RouteSize[]): string[] {
  return routes
    .filter((r) => r.gzipBytes > PERF_BUDGET.jsGzipBytesPerRoute)
    .map(
      (r) =>
        `${r.route}: ${kb(r.gzipBytes)} KB gzip first load JS, budget ${kb(PERF_BUDGET.jsGzipBytesPerRoute)} KB`,
    );
}

/**
 * First load JS per route from the Next build: the unique script files listed for each entry in
 * `app-build-manifest.json`, each gzipped once. Style sheets and source maps are not counted.
 */
export function routeSizesFromManifest(buildDir: string): RouteSize[] {
  const manifest = JSON.parse(readFileSync(join(buildDir, 'app-build-manifest.json'), 'utf8')) as {
    pages: Record<string, string[]>;
  };
  const cache = new Map<string, number>();
  const size = (file: string): number => {
    let value = cache.get(file);
    if (value === undefined) {
      value = gzipSync(readFileSync(join(buildDir, file))).length;
      cache.set(file, value);
    }
    return value;
  };
  return Object.entries(manifest.pages).map(([route, files]) => ({
    route,
    gzipBytes: [...new Set(files.filter((f) => f.endsWith('.js')))].reduce((sum, f) => sum + size(f), 0),
  }));
}

export interface ImageInfo {
  src: string;
  width: string | null;
  height: string | null;
  style: string | null;
  loading: string | null;
  fetchpriority: string | null;
  hero: boolean;
}

const attr = (tag: string, name: string): string | null => {
  const m = new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i').exec(tag);
  return m ? (m[1] ?? m[2] ?? m[3] ?? '') : null;
};

/** Reads the `img` tags of a page, in any attribute order. */
export function parseImages(html: string): ImageInfo[] {
  return [...html.matchAll(/<img\b[^>]*>/gi)].map((m) => {
    const tag = m[0];
    return {
      src: attr(tag, 'src') ?? '',
      width: attr(tag, 'width'),
      height: attr(tag, 'height'),
      style: attr(tag, 'style'),
      loading: attr(tag, 'loading')?.toLowerCase() ?? null,
      fetchpriority: attr(tag, 'fetchpriority')?.toLowerCase() ?? null,
      hero: attr(tag, 'data-hero') === 'true',
    };
  });
}

/**
 * Every image reserves its space (width and height, or an inline aspect ratio), the hero image is eager with high
 * fetch priority, and every other image is lazy.
 */
export function imageViolations(images: readonly ImageInfo[]): string[] {
  const out: string[] = [];
  for (const img of images) {
    const label = img.src || '(no src)';
    const sized = (img.width && img.height) || /aspect-ratio/i.test(img.style ?? '');
    if (!sized) out.push(`${label}: no width and height or aspect-ratio, the page will shift`);
    if (img.hero) {
      if (img.loading === 'lazy') out.push(`${label}: the hero image must not be lazy`);
      else if (img.fetchpriority !== 'high') out.push(`${label}: the hero image needs fetchpriority high`);
    } else if (img.loading !== 'lazy') {
      out.push(`${label}: images below the first must be lazy`);
    }
  }
  return out;
}

export function fontViolations(input: { preloaded: number; families: number }): string[] {
  const out: string[] = [];
  if (input.preloaded > PERF_BUDGET.maxPreloadedFonts) {
    out.push(`${input.preloaded} font files preloaded, budget ${PERF_BUDGET.maxPreloadedFonts}`);
  }
  if (input.families > PERF_BUDGET.maxFontFamilies) {
    out.push(`${input.families} font families, budget ${PERF_BUDGET.maxFontFamilies}`);
  }
  return out;
}

/** Font files a page asks the browser to preload, and the families they belong to (from the file names). */
export function fontPreloadsFromHtml(html: string): { files: string[]; families: string[] } {
  const files = [...html.matchAll(/<link\b[^>]*>/gi)]
    .map((m) => m[0])
    .filter((tag) => /\srel\s*=\s*["']?preload/i.test(tag) && /\sas\s*=\s*["']?font/i.test(tag))
    .map((tag) => attr(tag, 'href') ?? '')
    .filter(Boolean);
  const families = [
    ...new Set(
      files.map((f) =>
        (f.split('/').pop() ?? f)
          .replace(/\.[a-z0-9]+$/i, '')
          .replace(/^[0-9a-f]{8,}-s\.p\./i, '')
          .replace(/-(latin|vietnamese)[a-z-]*$/i, ''),
      ),
    ),
  ];
  return { files, families };
}
