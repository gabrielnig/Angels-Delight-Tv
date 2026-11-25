import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '..');

describe('pnpm share:check (L15b)', () => {
  it('is a package script', () => {
    expect(JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')).scripts['share:check']).toMatch(/share-check\.ts/);
  });

  it('passes its self test against the fixtures', () => {
    const out = execFileSync('pnpm', ['exec', 'tsx', 'scripts/share-check.ts', '--self-test'], { cwd: root, encoding: 'utf8' });
    expect(out).toContain('share:check self test passed');
  });

  it('runs in CI: the self test with the checks and the real pages against the fixture server', () => {
    const ci = readFileSync(resolve(root, '.github/workflows/ci.yml'), 'utf8');
    expect(ci).toMatch(/pnpm share:check --self-test/);
    expect(ci).toMatch(/pnpm share:check --base http:\/\/localhost:3113/);
  });
});
