/// <reference lib="dom" />
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import { chromium } from '@playwright/test';
import { resetDemo } from './demo/client';
import { assertAllowedOrigin } from './demo/origin-guard';
import { parseArticle, roleAllows, startsSignedOut } from './fact-check';
import { runSteps, type StepFailureReport, type StepResult } from './fact-run';
import { FACT_ROLE_OVERRIDES } from './fact-roles';
import { signInAs } from './helpers';
import { overlayInitScript } from './overlay';
import { PROFILES } from './profiles';
import { Session } from './session';

export interface FactReport {
  id: string;
  ok: boolean;
  role: string;
  results: StepResult[];
  failure: StepFailureReport | null;
}

const CONTENT = 'content/help/en';

/**
 * Re-runs one article on a clean demo stack from nothing but its step list and role. The demo is reset first, the role
 * signs in off camera, and the steps are followed in order until the first one that cannot be.
 */
export async function factCheckArticle(
  md: string,
  o: { baseURL: string; role?: string; clockMs?: number },
): Promise<FactReport> {
  assertAllowedOrigin(o.baseURL);
  const article = parseArticle(md);
  const role = o.role ?? FACT_ROLE_OVERRIDES[article.id] ?? article.role;
  if (!roleAllows(role, article.role)) {
    return {
      id: article.id,
      ok: false,
      role,
      results: [],
      failure: {
        n: 0,
        text: '',
        reason: `The article is for the ${article.role} role and above, but the check ran as ${role}.`,
      },
    };
  }
  const { now } = await resetDemo(o.baseURL);
  const browser = await chromium.launch({ executablePath: process.env.E2E_CHROMIUM_PATH });
  try {
    const profile = PROFILES.desktop;
    const context = await browser.newContext({
      baseURL: o.baseURL,
      viewport: { width: profile.width, height: profile.height },
      bypassCSP: true,
      locale: 'en-GB',
      timezoneId: 'Africa/Lagos',
    });
    await context.addInitScript({ content: overlayInitScript({ touch: false }) });
    await context.addInitScript({
      content: `try { localStorage.setItem('ad:notice:v1', JSON.stringify({ version: 1, at: ${(o.clockMs ?? now) - 86_400_000} })); } catch (e) {}`,
    });
    await context.clock.setFixedTime(o.clockMs ?? now);
    const page = await context.newPage();
    const s = new Session(page, profile, null, 0.1);
    // An article about signing in starts on the sign in page, like the person does, so it is not signed in for them.
    if (!startsSignedOut(article.steps)) {
      await signInAs(s, role as 'editor' | 'admin' | 'super_admin');
      await s.goto('/admin');
    }
    const r = await runSteps(s, article.steps, {
      role: role as 'editor' | 'admin' | 'super_admin',
    });
    return { id: article.id, ok: r.failure === null, role, ...r };
  } finally {
    await browser.close();
  }
}

export function formatReport(r: FactReport): string {
  const manual = r.results.filter((x) => x.status === 'manual').length;
  if (r.ok) {
    return `${r.id} passed as ${r.role}: ${r.results.length} steps followed (${manual} manual).`;
  }
  const f = r.failure!;
  return [
    `${r.id} FAILED at step ${f.n} as ${r.role}.`,
    f.text ? `  Step: ${f.text}` : '',
    `  Why: ${f.reason}`,
    `  Steps that passed before it: ${r.results.length}.`,
  ]
    .filter(Boolean)
    .join('\n');
}

async function findArticles(root: string): Promise<string[]> {
  const out: string[] = [];
  for (const e of await readdir(root, { withFileTypes: true })) {
    const p = join(root, e.name);
    if (e.isDirectory()) out.push(...(await findArticles(p)));
    else if (e.name.endsWith('.md') && /^[A-Z]\d+-/.test(e.name)) out.push(p);
  }
  return out.sort();
}

async function main() {
  const { values } = parseArgs({
    options: {
      article: { type: 'string' },
      file: { type: 'string' },
      role: { type: 'string' },
      all: { type: 'boolean', default: false },
      report: { type: 'string' },
      'base-url': { type: 'string', default: process.env.KB_BASE_URL ?? 'http://localhost:3141' },
    },
  });
  const baseURL = values['base-url']!;
  const files = values.file
    ? [values.file]
    : (await findArticles(CONTENT)).filter(
        (f) =>
          values.all || (values.article && f.split('/').pop()!.startsWith(`${values.article}-`)),
      );
  if (files.length === 0) {
    console.error('No article matched. Use --article D02, --file path or --all.');
    process.exit(2);
  }
  const reports: FactReport[] = [];
  for (const f of files) {
    const r = await factCheckArticle(await readFile(f, 'utf8'), { baseURL, role: values.role });
    reports.push(r);
    console.log(formatReport(r));
  }
  if (values.report) await writeFile(values.report, `${JSON.stringify(reports, null, 2)}\n`);
  process.exit(reports.every((r) => r.ok) ? 0 : 1);
}

if (process.argv[1]?.endsWith('fact-check-cli.ts')) {
  main().catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(2);
  });
}
