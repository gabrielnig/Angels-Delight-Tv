import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { resolveHelpImage } from './media';

const content = resolve(import.meta.dirname, '../../../../../content/help');

describe('resolveHelpImage (M50-S07)', () => {
  it('finds a committed picture and names its type', () => {
    const hit = resolveHelpImage(content, ['S04', 'S04-01-menu-desktop.webp']);
    expect(hit?.contentType).toBe('image/webp');
    expect(hit?.file.endsWith('content/help/media/S04/S04-01-menu-desktop.webp')).toBe(true);
  });

  it('refuses paths that leave the media folder or name other file types', () => {
    expect(resolveHelpImage(content, ['..', 'en', 'glossary.md'])).toBeNull();
    expect(resolveHelpImage(content, ['S04', '..', '..', 'coverage-gaps.json'])).toBeNull();
    expect(resolveHelpImage(content, ['S04', 'x.md'])).toBeNull();
    expect(resolveHelpImage(content, ['S04%2F..%2Fx.webp'])).toBeNull();
    expect(resolveHelpImage(content, [])).toBeNull();
  });

  it('answers null for a picture that does not exist', () => {
    expect(resolveHelpImage(content, ['S04', 'nothing.webp'])).toBeNull();
  });
});
