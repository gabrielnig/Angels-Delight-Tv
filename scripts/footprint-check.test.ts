import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const script = resolve(import.meta.dirname, 'footprint-check.sh');
const EM = '\u2014';
const EN = '\u2013';
const ROCKET = '\u{1F680}';
const CHECK_MARK = '\u2705';

let repo: string;

function git(...args: string[]) {
  return execFileSync('git', args, { cwd: repo, encoding: 'utf8' });
}

function stage(path: string, content: string) {
  const full = join(repo, path);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, content);
  git('add', path);
}

function run(...args: string[]) {
  const result = spawnSync('bash', [script, ...args], { cwd: repo, encoding: 'utf8' });
  return { code: result.status, output: `${result.stdout}${result.stderr}` };
}

beforeEach(() => {
  repo = mkdtempSync(join(tmpdir(), 'ad-footprint-'));
  git('init', '-q', '-b', 'main');
  git('config', 'user.name', 'ARKDEV');
  git('config', 'user.email', 'dev@example.invalid');
});

afterEach(() => rmSync(repo, { recursive: true, force: true }));

describe('footprint-check staged mode', () => {
  it('passes a clean diff', () => {
    stage('a.ts', 'export const a = 1;\n');
    expect(run().code).toBe(0);
  });

  it('fails on an em dash and names the file', () => {
    stage('a.md', `one ${EM} two\n`);
    const result = run();
    expect(result.code).toBe(1);
    expect(result.output).toContain('a.md');
  });

  it('fails on an en dash', () => {
    stage('a.md', `1${EN}2\n`);
    expect(run().code).toBe(1);
  });

  it('fails on a smart quote', () => {
    stage('a.md', 'it’s\n');
    expect(run().code).toBe(1);
  });

  it('fails on emoji from the pictograph and dingbat ranges', () => {
    stage('a.md', `ship ${ROCKET}\n`);
    expect(run().code).toBe(1);
    git('reset', '-q');
    stage('b.md', `done ${CHECK_MARK}\n`);
    expect(run().code).toBe(1);
  });

  it.each([
    'Co-Authored-By: Someone <a@b.c>',
    'Generated with a tool',
    'see claude.ai/code/session_1',
    'noreply@anthropic.com',
  ])('fails on the attribution pattern %s', (line) => {
    stage('a.md', `${line}\n`);
    expect(run().code).toBe(1);
  });

  it('ignores lines that were not added in this diff', () => {
    stage('a.md', `old ${EM} line\n`);
    git('commit', '-q', '-m', 'seed');
    stage('a.md', `old ${EM} line\nnew line\n`);
    expect(run().code).toBe(0);
  });

  it('skips docs/TDD-PROTOCOL.md, which documents the patterns', () => {
    stage('docs/TDD-PROTOCOL.md', `Co-Authored-By ${EM}\n`);
    expect(run().code).toBe(0);
  });

  it('skips the script itself', () => {
    stage('scripts/footprint-check.sh', `Co-Authored-By ${EM}\n`);
    expect(run().code).toBe(0);
  });
});

describe('footprint-check range mode', () => {
  it('fails when a commit message in the range has an attribution trailer', () => {
    stage('a.ts', 'export const a = 1;\n');
    git('commit', '-q', '-m', 'seed');
    git('branch', 'base');
    stage('b.ts', 'export const b = 1;\n');
    git('commit', '-q', '-m', 'Add b\n\nCo-Authored-By: Someone <a@b.c>');
    const result = run('--range', 'base..HEAD');
    expect(result.code).toBe(1);
    expect(result.output).toMatch(/commit message/i);
  });

  it('fails when a commit in the range is not authored by ARKDEV', () => {
    stage('a.ts', 'export const a = 1;\n');
    git('commit', '-q', '-m', 'seed');
    git('branch', 'base');
    stage('b.ts', 'export const b = 1;\n');
    git('-c', 'user.name=Someone', 'commit', '-q', '-m', 'Add b');
    const result = run('--range', 'base..HEAD');
    expect(result.code).toBe(1);
    expect(result.output).toMatch(/author/i);
  });

  it('passes ARKDEV commits with clean messages and diffs', () => {
    stage('a.ts', 'export const a = 1;\n');
    git('commit', '-q', '-m', 'seed');
    git('branch', 'base');
    stage('b.ts', 'export const b = 1;\n');
    git('commit', '-q', '-m', 'Add b so the range check has a clean case');
    expect(run('--range', 'base..HEAD').code).toBe(0);
  });
});
