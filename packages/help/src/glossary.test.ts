import { describe, expect, it } from 'vitest';
import { parseGlossary } from './glossary';

describe('parseGlossary', () => {
  it('reads terms, guides and aliases and sorts A to Z', () => {
    const terms = parseGlossary(
      [
        '## Poster',
        'The still picture shown for a video.',
        'Guides: D06, W05',
        'Aliases: thumbnail, cover',
        '',
        '## Caption',
        'The words shown on screen.',
      ].join('\n'),
    );
    expect(terms.map((t) => t.term)).toEqual(['Caption', 'Poster']);
    expect(terms[1]).toMatchObject({
      slug: 'poster',
      guides: ['D06', 'W05'],
      aliases: ['thumbnail', 'cover'],
    });
    expect(terms[0]?.guides).toEqual([]);
  });
  it('refuses duplicates, empty definitions and bad guide ids', () => {
    expect(() => parseGlossary('## A\nx\n\n## a\ny')).toThrow(/twice/);
    expect(() => parseGlossary('## A\n')).toThrow(/definition/);
    expect(() => parseGlossary('## A\nx\nGuides: nope')).toThrow(/guide/i);
  });
});
