import { describe, expect, it } from 'vitest';
import { parseArticle } from './article';
import { splitByRole } from './visibility';

const make = (id: string, role: string) =>
  parseArticle(
    `content/help/en/daily/${id}-x.md`,
    `---
id: ${id}
title: Title ${id}
path: daily
summary: Short.
role: ${role}
readMinutes: 1
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
1. Click **Go**.

## What you should see
Done.

## If something goes wrong
- **Bad.** Retry.
`,
  );

describe('splitByRole', () => {
  const all = [make('D01', 'editor'), make('D02', 'admin'), make('D03', 'super_admin')];
  it('hides guides for a higher role and counts them', () => {
    const editor = splitByRole(all, 'editor');
    expect(editor.visible.map((a) => a.meta.id)).toEqual(['D01']);
    expect(editor.hidden.map((a) => a.meta.id)).toEqual(['D02', 'D03']);
    const admin = splitByRole(all, 'admin');
    expect(admin.hidden.map((a) => a.meta.id)).toEqual(['D03']);
  });
  it('shows everything to a super admin and when asked to show all', () => {
    expect(splitByRole(all, 'super_admin').hidden).toEqual([]);
    const shown = splitByRole(all, 'editor', { showAll: true });
    expect(shown.hidden).toEqual([]);
    expect(shown.visible).toHaveLength(3);
    expect(shown.higher).toBe(2);
  });
});
