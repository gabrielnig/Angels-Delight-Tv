import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { checkContent, findContentDir, loadLibrary } from './node';

const real = resolve(import.meta.dirname, '../../../content/help');

describe('the committed content', () => {
  it('loads, lints clean and has its media', () => {
    const lib = loadLibrary(real);
    expect(lib.articles.map((a) => a.meta.id)).toEqual(expect.arrayContaining(['S04', 'D02', 'D07']));
    expect(lib.glossary.length).toBeGreaterThan(8);
    expect(checkContent(real)).toEqual([]);
  });
  it('finds the content folder from inside the repo', () => {
    expect(findContentDir(import.meta.dirname)).toBe(real);
  });
});

describe('checkContent on a broken folder', () => {
  it('names the file and the problem for a missing picture and a bad dash', () => {
    const dir = mkdtempSync(join(tmpdir(), 'help-'));
    mkdirSync(join(dir, 'en', 'daily'), { recursive: true });
    mkdirSync(join(dir, 'media'), { recursive: true });
    const src = `---
id: D01
title: A title
path: daily
summary: Short.
role: editor
readMinutes: 1
updated: 2026-11-25
locale: en
status: draft
textOnly: true
---
## What you will do
Do it \u2014 now.

## Before you start
Nothing.

## Steps
1. Click **Go**.
   ![A picture](missing.webp)

## What you should see
Done.

## If something goes wrong
- **Bad.** Retry.
`;
    writeFileSync(join(dir, 'en', 'daily', 'D01-a.md'), src);
    const problems = checkContent(dir);
    expect(problems.join('\n')).toMatch(/D01-a\.md.*missing\.webp/s);
    expect(problems.join('\n')).toMatch(/D01-a\.md.*dash/s);
  });
  it('throws a readable error when a file does not parse', () => {
    const dir = mkdtempSync(join(tmpdir(), 'help-'));
    mkdirSync(join(dir, 'en', 'daily'), { recursive: true });
    writeFileSync(join(dir, 'en', 'daily', 'D01-a.md'), 'no front matter');
    expect(() => loadLibrary(dir)).toThrow(/D01-a\.md/);
  });
});
