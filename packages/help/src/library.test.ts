import { describe, expect, it } from 'vitest';
import { parseArticle } from './article';
import { buildLibrary } from './library';

const make = (id: string, path: string, extra = '', slug = 'x') =>
  parseArticle(
    `content/help/en/${path}/${id}-${slug}.md`,
    `---
id: ${id}
title: Title ${id}
path: ${path}
summary: A short summary.
role: editor
readMinutes: 2
updated: 2026-11-25
locale: en
status: draft
textOnly: true
${extra}
---
## What you will do
Do it.

## Before you start
Nothing.

## Steps
1. Click **Go**.

## What you should see
Done.

## If something goes wrong
- **It fails.** Try again.
`,
  );

describe('buildLibrary', () => {
  it('orders articles by path then id and builds the paths', () => {
    const lib = buildLibrary([make('D02', 'daily'), make('S01', 'start'), make('D01', 'daily')]);
    expect(lib.articles.map((a) => a.meta.id)).toEqual(['S01', 'D01', 'D02']);
    expect(lib.paths.map((p) => p.key)).toEqual(['start', 'daily']);
    expect(lib.nextOf('D01')?.meta.id).toBe('D02');
    expect(lib.nextOf('D02')).toBeNull();
    expect(lib.prevOf('D02')?.meta.id).toBe('D01');
  });

  it('fails on duplicates and on needs or related ids that do not exist', () => {
    expect(() => buildLibrary([make('D01', 'daily'), make('D01', 'daily', '', 'y')])).toThrow(
      /D01.*twice/,
    );
    expect(() => buildLibrary([make('D01', 'daily', 'related: [D09]')])).toThrow(/D09/);
    expect(() => buildLibrary([make('D01', 'daily', 'needs: [S09]')])).toThrow(/S09/);
  });

  it('fails on a help link that points nowhere', () => {
    const a = make('D01', 'daily');
    a.trouble[0] = {
      cause: 'x',
      fix: [{ t: 'link', kind: 'help', href: 'T09', c: [{ t: 'text', v: 'T09' }] }],
    };
    expect(() => buildLibrary([a])).toThrow(/T09/);
  });

  it('maps screens to articles, main article first', () => {
    const lib = buildLibrary([
      make('D01', 'daily', 'screens: ["/admin/videos/upload", "/admin/videos"]'),
      make('D02', 'daily', 'screens: ["/admin/videos/upload"]'),
      make('D03', 'daily', 'screens: ["/admin/videos"]'),
    ]);
    expect(lib.forScreen('/admin/videos/upload').map((a) => a.meta.id)).toEqual(['D01', 'D02']);
    expect(lib.forScreen('/admin/videos').map((a) => a.meta.id)).toEqual(['D03', 'D01']);
    expect(lib.forScreen('/admin/nowhere')).toEqual([]);
    expect(lib.screenMap()).toEqual({
      '/admin/videos': ['D03', 'D01'],
      '/admin/videos/upload': ['D01', 'D02'],
    });
  });
});
