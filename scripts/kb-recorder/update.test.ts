import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { findArticle, updateArticleSteps } from './update';
import type { Episode } from './episode';

const root = () => {
  const dir = mkdtempSync(join(tmpdir(), 'kb-update-'));
  mkdirSync(join(dir, 'en', 'daily'), { recursive: true });
  writeFileSync(
    join(dir, 'en', 'daily', 'D02-upload-one-video.md'),
    '---\nid: D02\n---\n## Steps\n<!-- kb:steps D02 -->\n1. Old.\n<!-- /kb:steps -->\n\n## What you should see\nDone.\n',
  );
  return dir;
};

const episode: Episode = {
  id: 'D02',
  title: 'Upload one video',
  role: 'editor',
  steps: [{ caption: 'Click **Upload** in the side menu.', run: async () => {} }],
};

describe('findArticle', () => {
  it('finds the article file of an id under content/help/en', () => {
    const dir = root();
    expect(findArticle(dir, 'D02')).toBe(join(dir, 'en', 'daily', 'D02-upload-one-video.md'));
  });
  it('returns null when there is no article yet', () => {
    expect(findArticle(root(), 'D99')).toBeNull();
  });
});

describe('updateArticleSteps', () => {
  it('rewrites only the steps block and keeps the bold label', () => {
    const dir = root();
    const file = updateArticleSteps(dir, episode);
    const text = readFileSync(file!, 'utf8');
    expect(text).toContain('1. Click **Upload** in the side menu.');
    expect(text).not.toContain('1. Old.');
    expect(text).toContain('## What you should see\nDone.');
  });

  it('says plainly when the article has no markers', () => {
    const dir = root();
    writeFileSync(
      join(dir, 'en', 'daily', 'D02-upload-one-video.md'),
      '## Steps\n1. Hand written.\n',
    );
    expect(() => updateArticleSteps(dir, episode)).toThrow(/kb:steps D02/);
  });
});
