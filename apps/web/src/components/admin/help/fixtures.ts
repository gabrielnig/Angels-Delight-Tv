import { buildLibrary, parseArticle } from '@ad/help';

/** A tiny library for component tests. */
export function article(id: string, path: string, extra = '', title = `Title ${id}`) {
  const slug = 'x';
  return parseArticle(
    `content/help/en/${path}/${id}-${slug}.md`,
    `---
id: ${id}
title: ${title}
path: ${path}
summary: Summary for ${id}.
role: editor
readMinutes: 3
updated: 2026-11-25
locale: en
status: draft
textOnly: true
${extra}
---
## What you will do
Do the thing.

## Before you start
You need nothing.

## Steps
1. Click **Go**.
2. Wait for **Done**.

## What you should see
It says Done.

## If something goes wrong
- **It fails.** Try again. [Another guide](help:S01)
`,
  );
}

export const sampleLibrary = () =>
  buildLibrary(
    [
      article('S01', 'start', 'related: [D01]'),
      article(
        'D01',
        'daily',
        'needs: [S01]\nscreens: ["/admin/videos/upload"]\nactions: [video.upload, video.delete]\nrelated: [S01]',
      ),
      article(
        'D02',
        'daily',
        'role: admin\nroleNote: Editors can add, only Admins can remove.\nscreens: ["/admin/videos/[id]"]',
      ),
      article('C04', 'setup', 'role: super_admin'),
    ],
    [],
  );
