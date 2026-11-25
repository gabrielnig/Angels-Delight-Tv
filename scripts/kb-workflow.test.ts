import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '..');
const read = (p: string) => readFileSync(resolve(root, p), 'utf8');
const pkg = JSON.parse(read('package.json')) as { scripts: Record<string, string> };

const files = ['.github/workflows/kb-verify.yml', '.github/workflows/kb-nightly.yml'];

describe.each(files)('%s', (file) => {
  const text = read(file);

  it('is plain two space YAML with no tabs and a name, triggers and permissions', () => {
    expect(text).not.toMatch(/\t/);
    expect(text).toMatch(/^name: kb-/m);
    expect(text).toMatch(/^on:$/m);
    expect(text).toMatch(/^permissions:\n {2}contents: read$/m);
    for (const line of text.split('\n'))
      expect(line.length - line.trimStart().length).toSatisfy((n: number) => n % 2 === 0);
  });

  it('needs no secrets: it never reads the secrets context', () => {
    expect(text).not.toMatch(/secrets\./);
    expect(text).not.toMatch(/\$\{\{\s*secrets/);
  });

  it('pins every action to a major version and every job has a timeout', () => {
    for (const m of text.matchAll(/uses: ([^\s]+)/g)) expect(m[1]).toMatch(/@v\d+$/);
    const jobs = text.slice(text.indexOf('\njobs:\n')).match(/^ {2}[a-z][a-z-]*:$/gm) ?? [];
    expect(jobs.length).toBeGreaterThan(0);
    expect((text.match(/timeout-minutes:/g) ?? []).length).toBe(jobs.length);
  });

  it('runs on the fixture demo stack and never on a real database', () => {
    expect(text).toMatch(/scripts\/kb-stack\.sh start/);
    expect(text).not.toMatch(/DATABASE_URL|postgres/);
  });

  it('only calls scripts and pnpm commands that exist', () => {
    for (const m of text.matchAll(/(scripts\/[\w./-]+\.sh)/g))
      expect(existsSync(resolve(root, m[1]!))).toBe(true);
    for (const m of text.matchAll(/pnpm (kb:[\w-]+)/g)) expect(pkg.scripts).toHaveProperty(m[1]!);
  });
});

describe('kb-verify (pull requests, fast)', () => {
  const text = read('.github/workflows/kb-verify.yml');
  it('runs on pull requests that touch admin screens, nav, permissions, the settings registry, the harness or help content', () => {
    expect(text).toMatch(/pull_request:/);
    for (const p of [
      'apps/web/src/app/admin/\\*\\*',
      'apps/web/src/components/admin/\\*\\*',
      'apps/web/src/lib/admin/\\*\\*',
      'packages/theme/src/settings-registry.ts',
      'scripts/kb-recorder/\\*\\*',
      'content/help/\\*\\*',
    ]) {
      expect(text).toMatch(new RegExp(p));
    }
  });
  it('checks only the changed episodes with no video', () => {
    expect(text).toMatch(/pnpm kb:verify --changed/);
    expect(text).not.toMatch(/kb:record/);
  });
  it('keeps the report as an artifact when it fails', () => {
    expect(text).toMatch(/upload-artifact@v4/);
    expect(text).toMatch(/if: failure\(\)/);
  });
});

describe('kb-nightly (full run)', () => {
  const text = read('.github/workflows/kb-nightly.yml');
  it('runs on a schedule, on release tags and by hand', () => {
    expect(text).toMatch(/schedule:/);
    expect(text).toMatch(/cron: '[\d*/ ]+'/);
    expect(text).toMatch(/tags: \['v\*'\]/);
    expect(text).toMatch(/workflow_dispatch:/);
  });
  it('records everything, checks lengths against the last run and compares screenshots', () => {
    expect(text).toMatch(/pnpm kb:record --all/);
    expect(text).toMatch(/--compare/);
    expect(text).toMatch(/pnpm kb:shots-diff/);
    expect(text).toMatch(/--max-percent 0\.5/);
  });
  it('installs ffmpeg and the caption font and uploads the output and the diffs', () => {
    expect(text).toMatch(/ffmpeg/);
    expect(text).toMatch(/fonts-inter/);
    expect(text).toMatch(/upload-artifact@v4/);
  });
});

describe('kb-stack start mode', () => {
  const sh = read('scripts/kb-stack.sh');
  it('has a start mode for a built app and quotes NODE_OPTIONS when printing the environment', () => {
    expect(sh).toMatch(/^ {2}start\)/m);
    expect(sh).toMatch(/NODE_OPTIONS="/);
  });
});
