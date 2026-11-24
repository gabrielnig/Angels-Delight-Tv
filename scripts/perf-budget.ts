/**
 * Performance budget check (M45-S13). Usage:
 *   pnpm perf:budget                       first load JS per route from apps/web/.next
 *   pnpm perf:budget --base http://localhost:3000 /  /search  /browse
 *                                          also checks images and font preloads in each page's HTML
 * Exits 1 when any budget is broken. LCP, CLS and INP come from the browser (vitals dashboard or Lighthouse).
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  PERF_BUDGET,
  fontPreloadsFromHtml,
  fontViolations,
  imageViolations,
  jsViolations,
  parseImages,
  routeSizesFromManifest,
} from '../apps/web/src/lib/perf/budget';

async function main(): Promise<number> {
  const args = process.argv.slice(2);
  const baseAt = args.indexOf('--base');
  const base = baseAt >= 0 ? args[baseAt + 1] : undefined;
  const pages = args.filter((a, i) => a.startsWith('/') && i !== baseAt + 1);
  const buildDir = resolve(import.meta.dirname, '../apps/web/.next');
  const problems: string[] = [];

  try {
    readFileSync(resolve(buildDir, 'app-build-manifest.json'));
    const sizes = routeSizesFromManifest(buildDir);
    for (const s of sizes) console.log(`${(s.gzipBytes / 1024).toFixed(1).padStart(7)} KB  ${s.route}`);
    problems.push(...jsViolations(sizes));
  } catch {
    problems.push('No build found. Run pnpm --filter @ad/web build first.');
  }

  if (base) {
    for (const path of pages.length > 0 ? pages : ['/']) {
      const html = await (await fetch(new URL(path, base))).text();
      const fonts = fontPreloadsFromHtml(html);
      for (const v of [
        ...imageViolations(parseImages(html)),
        ...fontViolations({ preloaded: fonts.files.length, families: fonts.families.length }),
      ]) {
        problems.push(`${path}: ${v}`);
      }
    }
  }

  if (problems.length > 0) {
    console.error(`\nPerformance budget broken (${problems.length}):`);
    for (const p of problems) console.error(`  ${p}`);
    return 1;
  }
  console.log(`\nWithin budget: ${PERF_BUDGET.jsGzipBytesPerRoute / 1024} KB JS per route.`);
  return 0;
}

process.exit(await main());
