import { describe, expect, it } from 'vitest';
import { sampleLibrary } from '@/components/admin/help/fixtures';
import { panelFor } from './help-panel';

const lib = sampleLibrary();

describe('panelFor (M50-S03)', () => {
  it('gives the guide for a screen with its steps and the link to the full guide', () => {
    const data = panelFor(lib, 'editor', '/admin/videos/upload');
    expect(data.guides.map((g) => g.id)).toEqual(['D01']);
    const g = data.guides[0]!;
    expect(g.href).toBe('/admin/help/D01');
    expect(g.steps).toHaveLength(2);
    expect(g.readMinutes).toBe(3);
    expect(g.video).toBeUndefined();
  });

  it('matches a dynamic route by its pattern and labels a guide for a higher role', () => {
    const data = panelFor(lib, 'editor', '/admin/videos/abc-123');
    expect(data.guides.map((g) => g.id)).toEqual(['D02']);
    expect(data.guides[0]!.higher).toBe(true);
    expect(panelFor(lib, 'admin', '/admin/videos/abc-123').guides[0]!.higher).toBe(false);
  });

  it('gives no guide and the core tasks for a screen without one', () => {
    const data = panelFor(lib, 'editor', '/admin/nothing-here');
    expect(data.guides).toEqual([]);
    expect(data.core.map((c) => c.id)).toEqual(['S01', 'D01']);
    expect(data.core.every((c) => c.href.startsWith('/admin/help/'))).toBe(true);
  });

  it('keeps guides for a higher role out of the core tasks', () => {
    const data = panelFor(lib, 'editor', '/admin/x');
    expect(data.core.map((c) => c.id)).not.toContain('D02');
  });

  it('is plain data so it can cross from the server', () => {
    const data = panelFor(lib, 'editor', '/admin/videos/upload');
    expect(JSON.parse(JSON.stringify(data))).toEqual(data);
  });

  it('shows the help pages themselves as no guide', () => {
    expect(panelFor(lib, 'editor', '/admin/help/D01').guides).toEqual([]);
  });

  it('puts a named guide first, for an inline hint, and ignores an unknown id', () => {
    const named = panelFor(lib, 'editor', '/admin/videos/upload', 'S01');
    expect(named.guides.map((g) => g.id)).toEqual(['S01', 'D01']);
    expect(panelFor(lib, 'editor', '/admin/videos/upload', 'Z99').guides.map((g) => g.id)).toEqual([
      'D01',
    ]);
  });
});
