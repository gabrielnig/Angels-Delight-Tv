/**
 * Share metadata check (lane L15b). Usage:
 *   pnpm share:check --self-test                      rules against built in fixtures, no network
 *   pnpm share:check --base http://localhost:3000     public pages of a running build
 *   pnpm share:check --base URL /about /title/some-slug --private /search
 * With no paths it checks Home, Browse, About, Help, Donate, Transparency and up to three videos and series found in
 * /sitemap.xml. A base that is plain http (a local build) allows http urls and reads pictures from the base even
 * when the page names another origin. Exits 1 when anything fails. Facebook, WhatsApp and LinkedIn still need the
 * live site: see docs/lanes/L15-build.md.
 */
import {
  FIXTURES,
  checkImage,
  checkPage,
  parseHead,
  type ImageFetch,
  type PageOptions,
} from '../apps/web/src/lib/seo/share-check';

interface Row {
  url: string;
  status: string;
  tags: string;
  image: string;
  bytes: string;
  ms: string;
  issues: string[];
}

const PAGE_MAX_MS = 3000;

async function fetchImage(url: string): Promise<ImageFetch> {
  const started = Date.now();
  const res = await fetch(url, { redirect: 'manual', headers: { 'user-agent': 'share-check' } });
  const bytes = Buffer.from(await res.arrayBuffer());
  return {
    status: res.status,
    redirected: res.status >= 300 && res.status < 400,
    contentType: res.headers.get('content-type') ?? '',
    bytes,
    length: Number(res.headers.get('content-length')) || bytes.length,
    ms: Date.now() - started,
  };
}

/** Pages a site can switch off (donations). A 404 that asks not to be indexed counts as switched off, not as a failure. */
const OPTIONAL_PAGES = new Set(['/donate', '/transparency']);

async function checkUrl(base: string, path: string, kind: PageOptions['kind'], allowHttp: boolean): Promise<Row> {
  const url = new URL(path, base).toString();
  const row: Row = { url: path, status: '-', tags: '-', image: '-', bytes: '-', ms: '-', issues: [] };
  const started = Date.now();
  let res: Response;
  try {
    res = await fetch(url, { redirect: 'manual', headers: { 'user-agent': 'share-check', accept: 'text/html' } });
  } catch (error) {
    row.issues.push(`request failed: ${(error as Error).message}`);
    return row;
  }
  const html = await res.text();
  const ms = Date.now() - started;
  row.status = String(res.status);
  row.ms = String(ms);
  if (res.status === 404 && OPTIONAL_PAGES.has(path) && /noindex/i.test(parseHead(html).robots ?? '')) {
    row.tags = 'switched off';
    return row;
  }
  if (res.status !== 200) row.issues.push(`page status ${res.status}, want 200 with no redirect`);
  if (ms > PAGE_MAX_MS) row.issues.push(`page is slow (${ms} ms)`);
  const page = checkPage(html, url, { kind, allowHttp });
  row.issues.push(...page);
  row.tags = page.length === 0 ? 'ok' : `${page.length} issue${page.length === 1 ? '' : 's'}`;
  if (kind === 'private') return row;
  const tags = parseHead(html);
  const imageUrl = tags.meta.get('og:image')?.[0];
  if (!imageUrl) return row;
  const target = allowHttp ? new URL(new URL(imageUrl, base).pathname + new URL(imageUrl, base).search, base).toString() : imageUrl;
  try {
    const fetched = await fetchImage(target);
    const issues = checkImage(fetched, {
      width: Number(tags.meta.get('og:image:width')?.[0]),
      height: Number(tags.meta.get('og:image:height')?.[0]),
      type: tags.meta.get('og:image:type')?.[0],
    });
    row.issues.push(...issues);
    row.image = issues.length === 0 ? 'ok' : `${issues.length} issue${issues.length === 1 ? '' : 's'}`;
    row.bytes = `${Math.round(fetched.length / 1000)} KB`;
  } catch (error) {
    row.issues.push(`image request failed: ${(error as Error).message}`);
    row.image = 'failed';
  }
  return row;
}

async function discover(base: string): Promise<string[]> {
  const found: string[] = [];
  try {
    const index = await (await fetch(new URL('/sitemap.xml', base))).text();
    const chunks = [...index.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]!);
    for (const chunk of chunks.slice(0, 2)) {
      const xml = await (await fetch(new URL(new URL(chunk).pathname, base))).text();
      for (const m of xml.matchAll(/<loc>([^<]+)<\/loc>/g)) {
        const path = new URL(m[1]!).pathname;
        if (/^\/(title|series)\//.test(path)) found.push(path);
      }
    }
  } catch {
    // No sitemap: only the fixed pages are checked.
  }
  const videos = found.filter((p) => p.startsWith('/title/')).slice(0, 3);
  const series = found.filter((p) => p.startsWith('/series/')).slice(0, 3);
  return [...videos, ...series];
}

function print(rows: Row[]): void {
  const cols = ['url', 'status', 'tags', 'image', 'bytes', 'ms'] as const;
  const width = Object.fromEntries(cols.map((c) => [c, Math.max(c.length, ...rows.map((r) => r[c].length))]));
  const line = (r: Record<string, string>) => cols.map((c) => (r[c] ?? '').padEnd(width[c]!)).join('  ');
  console.log(line(Object.fromEntries(cols.map((c) => [c, c]))));
  console.log(cols.map((c) => '-'.repeat(width[c]!)).join('  '));
  for (const row of rows) console.log(line(row as unknown as Record<string, string>));
  for (const row of rows) for (const issue of row.issues) console.log(`  ${row.url}: ${issue}`);
}

function selfTest(): number {
  const failures: string[] = [];
  const expectClean = (name: string, issues: string[]) => issues.length && failures.push(`${name} should pass: ${issues.join('; ')}`);
  const expectIssues = (name: string, issues: string[]) => issues.length === 0 && failures.push(`${name} should fail`);
  expectClean('good video', checkPage(FIXTURES.goodVideo.html, FIXTURES.goodVideo.url, { kind: 'video' }));
  expectClean('good series', checkPage(FIXTURES.goodSeries.html, FIXTURES.goodSeries.url, { kind: 'series' }));
  expectIssues('bad video', checkPage(FIXTURES.badVideo.html, FIXTURES.badVideo.url, { kind: 'video' }));
  expectIssues('empty page', checkPage('<head></head>', 'https://e.test/', { kind: 'website' }));
  expectIssues('slow redirecting image', checkImage({ status: 302, redirected: true, contentType: 'text/html', bytes: Buffer.alloc(10), length: 10, ms: 9000 }, {}));
  const rows: Row[] = [
    { url: 'fixture good video', status: '200', tags: 'ok', image: 'ok', bytes: '-', ms: '-', issues: [] },
    { url: 'fixture bad video', status: '200', tags: 'rejected', image: '-', bytes: '-', ms: '-', issues: [] },
  ];
  print(rows);
  if (failures.length) console.error(failures.join('\n'));
  else console.log('share:check self test passed');
  return failures.length ? 1 : 0;
}

async function main(): Promise<number> {
  const args = process.argv.slice(2);
  if (args.includes('--self-test')) return selfTest();
  const value = (flag: string) => (args.includes(flag) ? args[args.indexOf(flag) + 1] : undefined);
  const base = value('--base') ?? 'http://localhost:3000';
  const allowHttp = args.includes('--allow-http') || base.startsWith('http://');
  const privateAt = args.indexOf('--private');
  const privatePaths = privateAt >= 0 ? args.slice(privateAt + 1).filter((a) => a.startsWith('/')) : ['/search'];
  const given = args.filter((a, i) => a.startsWith('/') && i !== args.indexOf('--base') + 1 && !(privateAt >= 0 && i > privateAt));
  const paths = given.length ? given : ['/', '/browse', '/about', '/help', '/donate', '/transparency', ...(await discover(base))];
  const rows: Row[] = [];
  for (const path of paths) {
    const kind = path.startsWith('/title/') ? 'video' : path.startsWith('/series/') ? 'series' : 'website';
    rows.push(await checkUrl(base, path, kind, allowHttp));
  }
  for (const path of privatePaths) rows.push(await checkUrl(base, path, 'private', allowHttp));
  print(rows);
  const failed = rows.filter((r) => r.issues.length > 0).length;
  console.log(failed === 0 ? `\n${rows.length} urls passed` : `\n${failed} of ${rows.length} urls have issues`);
  return failed === 0 ? 0 : 1;
}

main().then((code) => process.exit(code));
