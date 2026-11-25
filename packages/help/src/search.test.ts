import { describe, expect, it } from 'vitest';
import { parseArticle } from './article';
import { buildLibrary } from './library';
import { buildSearchIndex, highlight, search, tokenize } from './search';

const make = (id: string, path: string, title: string, extra = '', step = 'Click **Go**.') =>
  parseArticle(
    `content/help/en/${path}/${id}-x.md`,
    `---
id: ${id}
title: ${title}
path: ${path}
summary: Summary of ${title}.
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
1. ${step}

## What you should see
Done.

## If something goes wrong
- **Bad.** Retry.
`,
  );

const lib = buildLibrary([
  make('D06', 'daily', 'Choose or upload a poster', 'aliases: [thumbnail, cover, picture]'),
  make('D08', 'daily', 'Publish or unpublish a video', 'aliases: [go live, release]'),
  make(
    'D07',
    'daily',
    'Review and approve captions',
    'aliases: [subtitles, cc]',
    'Fix wrong words in the cue list.',
  ),
  make('C04', 'setup', 'Features and limits', 'role: super_admin\naliases: [switches]'),
  make('M02', 'money', 'Turn sponsors on', 'role: admin\naliases: [adverts, ads]'),
]);
const index = buildSearchIndex(lib);

describe('tokenize', () => {
  it('lowercases, drops punctuation and reduces plurals', () => {
    expect(tokenize('Posters, Captions! Categories')).toEqual(['poster', 'caption', 'category']);
    expect(tokenize('Go-live now')).toEqual(['go', 'live', 'now']);
  });
});

describe('search', () => {
  it('finds a guide by its plain word alias and ranks it first', () => {
    expect(search(index, 'thumbnail', { role: 'editor' }).results[0]?.id).toBe('D06');
    expect(search(index, 'poster', { role: 'editor' }).results[0]?.id).toBe('D06');
    expect(search(index, 'subtitles', { role: 'editor' }).results[0]?.id).toBe('D07');
    expect(search(index, 'go live', { role: 'editor' }).results[0]?.id).toBe('D08');
  });

  it('matches an id exactly and finds words in the steps', () => {
    expect(search(index, 'd07', { role: 'editor' }).results[0]?.id).toBe('D07');
    expect(search(index, 'cue list', { role: 'editor' }).results[0]?.id).toBe('D07');
  });

  it('forgives one wrong letter in a word of five or more letters', () => {
    expect(search(index, 'postr', { role: 'editor' }).results[0]?.id).toBe('D06');
    expect(search(index, 'captons', { role: 'editor' }).results[0]?.id).toBe('D07');
    expect(search(index, 'pos', { role: 'editor' }).results).toEqual([]);
  });

  it('ranks what the role can do above higher role guides, which stay in the list with a flag', () => {
    const hits = search(index, 'on', { role: 'editor' }).results;
    expect(hits.map((h) => h.id)).toContain('M02');
    const sponsors = search(index, 'sponsors', { role: 'editor' }).results[0]!;
    expect(sponsors).toMatchObject({ id: 'M02', higher: true, roleNeeded: 'admin' });
    const mixed = search(index, 'video poster', { role: 'editor' }).results;
    expect(mixed.every((h, i, a) => i === 0 || !(a[i - 1]!.higher && !h.higher))).toBe(true);
  });

  it('suggests a word when nothing matches', () => {
    const out = search(index, 'sponsrs', { role: 'admin' });
    expect(out.results[0]?.id).toBe('M02');
    const none = search(index, 'zzzzzz', { role: 'admin' });
    expect(none.results).toEqual([]);
    expect(search(index, 'postar x', { role: 'admin' }).didYouMean).toBeUndefined();
  });

  it('returns nothing for an empty query', () => {
    expect(search(index, '   ', { role: 'editor' })).toEqual({ results: [] });
  });
});

describe('highlight', () => {
  it('marks words that match the query, plurals included', () => {
    expect(highlight('Choose or upload a poster', 'posters')).toEqual([
      { text: 'Choose or upload a ', match: false },
      { text: 'poster', match: true },
    ]);
    expect(highlight('Nothing here', 'poster')).toEqual([{ text: 'Nothing here', match: false }]);
  });
});
