import { describe, expect, it } from 'vitest';
import { parseArticle } from './article';

const good = `---
id: D02
title: Upload one video
path: daily
summary: Add a video file so you can prepare and publish it.
role: editor
needs: [S04]
related: [D03]
readMinutes: 4
watchSeconds: 210
video:
  id: VD02
screens: ["/admin/videos/upload"]
actions: [video.upload]
aliases: [add video]
verifiedAgainst: v1.0.0 (abc1234)
updated: 2026-11-25
locale: en
status: draft
---
## What you will do
Add a video file. You end with a draft you can edit.

## Before you start
You need a video file on your computer.

## Steps
1. Click **Upload** in the side menu.
   ![Upload in the menu](d02-menu.webp)
2. Drag your video onto the box.
   > [!CAREFUL]
   > Keep this page open until the row says Done.

## What you should see
The row says **Done**.

## If something goes wrong
- **The bar stops.** Check your connection. [An upload keeps failing](help:T05)
`;

describe('parseArticle', () => {
  it('reads a complete article', () => {
    const a = parseArticle('content/help/en/daily/D02-upload-one-video.md', good);
    expect(a.meta.id).toBe('D02');
    expect(a.meta.video).toEqual({ id: 'VD02', phone: false, captions: 'track' });
    expect(a.steps).toHaveLength(2);
    expect(a.steps[0]?.id).toBe('step-1');
    expect(a.steps[0]?.blocks[0]).toMatchObject({ t: 'image', src: 'd02-menu.webp' });
    expect(a.steps[1]?.blocks[0]).toMatchObject({ t: 'callout', kind: 'careful' });
    expect(a.trouble).toHaveLength(1);
    expect(a.trouble[0]?.fix.length).toBeGreaterThan(0);
    expect(a.text).toContain('Upload one video');
    expect(a.text).toContain('Drag your video onto the box');
  });

  it('names the file when front matter breaks the schema', () => {
    const bad = good.replace('role: editor', 'role: wizard');
    expect(() => parseArticle('content/help/en/daily/D02-upload-one-video.md', bad)).toThrow(
      /D02-upload-one-video\.md.*role/s,
    );
  });

  it('requires the five sections in the fixed order', () => {
    const swapped = good.replace('## Before you start', '## Zebra');
    expect(() => parseArticle('content/help/en/daily/D02-x.md', swapped)).toThrow(
      /Before you start/,
    );
    const order = good
      .replace('## What you will do', '## TMP')
      .replace('## Before you start', '## What you will do')
      .replace('## TMP', '## Before you start');
    expect(() => parseArticle('content/help/en/daily/D02-x.md', order)).toThrow(/order/i);
  });

  it('requires the folder and the file name to match the id and path', () => {
    expect(() => parseArticle('content/help/en/weekly/D02-upload.md', good)).toThrow(/folder/i);
    expect(() => parseArticle('content/help/en/daily/D03-upload.md', good)).toThrow(/file name/i);
  });

  it('refuses a summary of 20 words or more and a path letter mismatch', () => {
    const long = good.replace(
      'summary: Add a video file so you can prepare and publish it.',
      `summary: ${Array.from({ length: 21 }, () => 'word').join(' ')}`,
    );
    expect(() => parseArticle('content/help/en/daily/D02-x.md', long)).toThrow(/summary/);
    expect(() =>
      parseArticle('content/help/en/daily/D02-x.md', good.replace('id: D02', 'id: W02')),
    ).toThrow();
  });

  it('allows a text only article without a video when marked', () => {
    const textOnly = good
      .replace(/video:\n {2}id: VD02\n/, '')
      .replace('watchSeconds: 210\n', '')
      .replace('status: draft', 'status: draft\ntextOnly: true');
    expect(parseArticle('content/help/en/daily/D02-x.md', textOnly).meta.textOnly).toBe(true);
  });

  it('flags steps that hold more than one list or an empty steps section', () => {
    const empty = good.replace(
      /## Steps[\s\S]*## What you should see/,
      '## Steps\nNothing here.\n\n## What you should see',
    );
    expect(() => parseArticle('content/help/en/daily/D02-x.md', empty)).toThrow(/steps/i);
  });
});
