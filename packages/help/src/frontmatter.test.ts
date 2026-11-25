import { describe, expect, it } from 'vitest';
import { parseFrontMatter } from './frontmatter';

describe('parseFrontMatter', () => {
  it('reads scalars, inline lists, quoted strings, numbers and booleans', () => {
    const { data, body } = parseFrontMatter(
      [
        '---',
        'id: D02',
        'title: Upload one video',
        'readMinutes: 4',
        'textOnly: true',
        'needs: [S04, S05]',
        'screens: ["/admin/videos/upload", "/admin/videos/[id]"]',
        'aliases: [add video, go live]',
        'empty: []',
        '---',
        '## Steps',
      ].join('\n'),
    );
    expect(data).toEqual({
      id: 'D02',
      title: 'Upload one video',
      readMinutes: 4,
      textOnly: true,
      needs: ['S04', 'S05'],
      screens: ['/admin/videos/upload', '/admin/videos/[id]'],
      aliases: ['add video', 'go live'],
      empty: [],
    });
    expect(body.trim()).toBe('## Steps');
  });

  it('reads one level of nested map and block lists', () => {
    const { data } = parseFrontMatter(
      [
        '---',
        'video:',
        '  id: VD02',
        '  phone: true',
        'related:',
        '  - D03',
        '  - D04',
        '---',
        '',
      ].join('\n'),
    );
    expect(data).toEqual({ video: { id: 'VD02', phone: true }, related: ['D03', 'D04'] });
  });

  it('keeps colons inside values and ignores comment lines', () => {
    const { data } = parseFrontMatter(
      ['---', '# a comment', 'summary: Do this: then that', '---', ''].join('\n'),
    );
    expect(data).toEqual({ summary: 'Do this: then that' });
  });

  it('throws a clear error when the block is missing or unclosed', () => {
    expect(() => parseFrontMatter('## No front matter')).toThrow(/front matter/i);
    expect(() => parseFrontMatter('---\nid: D02\n')).toThrow(/closed/i);
  });

  it('throws on a line it cannot read, naming the line', () => {
    expect(() => parseFrontMatter('---\nthis is not a pair\n---\n')).toThrow(/line 2/);
  });
});
