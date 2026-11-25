import { describe, expect, it } from 'vitest';
import { parseArticle } from './article';
import { lintArticle, lintText } from './lint';

describe('lintText', () => {
  it('flags dashes, emoji and banned words outside quoted labels', () => {
    expect(lintText('Use this \u2014 now')).toEqual([expect.stringMatching(/dash/i)]);
    expect(lintText('Nice \u{1F600}')).toEqual([expect.stringMatching(/emoji/i)]);
    expect(lintText('Utilize the leverage')).toHaveLength(2);
    expect(lintText('Click **Utilize**')).toEqual([]);
    expect(lintText('Plain words only.')).toEqual([]);
  });
});

describe('lintArticle', () => {
  const base = `---
id: D02
title: Upload one video
path: daily
summary: Add a video file.
role: editor
readMinutes: 2
updated: 2026-11-25
locale: en
status: draft
textOnly: true
---
## What you will do
Do it.

## Before you start
Nothing.

## Steps
1. STEP

## What you should see
Done.

## If something goes wrong
- **It fails.** Try again.
`;
  it('passes a clean article', () => {
    expect(
      lintArticle(
        parseArticle('content/help/en/daily/D02-x.md', base.replace('STEP', 'Click **Upload**.')),
      ),
    ).toEqual([]);
  });
  it('flags a step over 25 words', () => {
    const long = Array.from({ length: 26 }, () => 'word').join(' ');
    expect(
      lintArticle(parseArticle('content/help/en/daily/D02-x.md', base.replace('STEP', long)))[0],
    ).toMatch(/step 1.*words/i);
  });
});
