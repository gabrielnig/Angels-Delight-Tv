import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ci = readFileSync(resolve(import.meta.dirname, '../.github/workflows/ci.yml'), 'utf8');

describe('CI workflow (M33-S02 AC1)', () => {
  it('runs on pull requests and on main', () => {
    expect(ci).toMatch(/pull_request:/);
    expect(ci).toMatch(/branches: \[main\]/);
  });

  it.each([
    ['lint', /run: pnpm lint/],
    ['typecheck', /run: pnpm typecheck/],
    ['scoped tests for changed paths', /vitest run --changed origin\/main/],
    ['dash and emoji grep', /scripts\/footprint-check\.sh/],
    ['secret scan', /scripts\/secret-scan\.sh/],
    ['build', /run: pnpm --filter @ad\/web build/],
    ['static analysis', /scripts\/sast\.sh/],
    ['software bill of materials', /scripts\/sbom\.mjs/],
  ])('has a %s step', (_name, pattern) => {
    expect(ci).toMatch(pattern);
  });

  it('never runs the whole suite', () => {
    expect(ci).not.toMatch(/run: pnpm (test|vitest run)\s*$/m);
  });
});
