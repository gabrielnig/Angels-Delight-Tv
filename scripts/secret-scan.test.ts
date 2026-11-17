import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const script = resolve(import.meta.dirname, 'secret-scan.sh');
let repo: string;
// A git hook runs tests with GIT_* variables that point at the outer repo. Drop them so the temp repo is isolated.
const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith('GIT_')));

function git(...args: string[]) {
  return execFileSync('git', args, { cwd: repo, encoding: 'utf8', env });
}
function track(path: string, content: string) {
  const full = join(repo, path);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, content);
  git('add', path);
}
function run() {
  const r = spawnSync('bash', [script], { cwd: repo, encoding: 'utf8', env });
  return { code: r.status, output: `${r.stdout}${r.stderr}` };
}

beforeEach(() => {
  repo = mkdtempSync(join(tmpdir(), 'ad-secrets-'));
  git('init', '-q', '-b', 'main');
});
afterEach(() => rmSync(repo, { recursive: true, force: true }));

describe('secret-scan', () => {
  it('passes a clean tree', () => {
    track('src/a.ts', 'export const x = 1;\n');
    expect(run().code).toBe(0);
  });

  const bad: Array<[string, string]> = [
    ['a private key block', '-----BEGIN ' + 'RSA PRIVATE KEY-----\nabc\n'],
    ['an AWS access key id', 'const k = "AKIA' + 'ABCDEFGHIJKLMNOP";\n'],
    ['a GitHub token', 'const t = "ghp_' + 'a'.repeat(36) + '";\n'],
    ['a Slack token', 'const t = "xoxb-' + '1234567890-abcdefghij";\n'],
    ['a hard coded secret assignment', 'const apiSecret = "' + 'Zk3pQ9vL2mX8wR5tY7uB4nC6' + '";\n'],
    ['a database url with a real password', 'DATABASE_URL=postgres://app:' + 'Zk3pQ9vL2mX8@db.prod-host.net:5432/ad\n'],
  ];
  for (const [name, content] of bad) {
    it(`fails on ${name} and names the file without printing the value`, () => {
      track('src/leak.ts', content);
      const { code, output } = run();
      expect(code).toBe(1);
      expect(output).toContain('src/leak.ts');
      expect(output).not.toContain('Zk3pQ9vL2mX8');
      expect(output).not.toContain('ABCDEFGHIJKLMNOP');
    });
  }

  it('allows local development credentials and env var references', () => {
    track('docs/dev.md', 'DATABASE_URL=postgres://postgres:postgres@localhost:5432/ad\n');
    track('src/b.ts', 'const secret = process.env.FIELD_KEK;\nconst token = "";\n');
    expect(run().code).toBe(0);
  });

  it('honours an inline allow marker and ignores untracked files', () => {
    track('src/c.ts', 'const k = "AKIA' + 'ABCDEFGHIJKLMNOP"; // secret-scan:allow\n');
    writeFileSync(join(repo, 'untracked.env'), 'ghp_' + 'a'.repeat(36));
    expect(run().code).toBe(0);
  });

  it('refuses a tracked .env file', () => {
    track('apps/web/.env', 'X=1\n');
    expect(run().code).toBe(1);
  });
});
