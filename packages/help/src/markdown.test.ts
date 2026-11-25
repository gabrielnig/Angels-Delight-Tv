import { describe, expect, it } from 'vitest';
import { parseBlocks, parseInline, plainText } from './markdown';

describe('parseInline', () => {
  it('reads bold, italic and code', () => {
    expect(parseInline('Click **Upload** then *wait* for `Done`.')).toEqual([
      { t: 'text', v: 'Click ' },
      { t: 'strong', c: [{ t: 'text', v: 'Upload' }] },
      { t: 'text', v: ' then ' },
      { t: 'em', c: [{ t: 'text', v: 'wait' }] },
      { t: 'text', v: ' for ' },
      { t: 'code', v: 'Done' },
      { t: 'text', v: '.' },
    ]);
  });

  it('classifies links and refuses unsafe ones', () => {
    const [help] = parseInline('[Fix it](help:T01#steps)');
    expect(help).toMatchObject({ t: 'link', kind: 'help', href: 'T01#steps' });
    const [gloss] = parseInline('[caption](glossary:caption)');
    expect(gloss).toMatchObject({ t: 'link', kind: 'glossary', href: 'caption' });
    const [admin] = parseInline('[Videos](/admin/videos)');
    expect(admin).toMatchObject({ t: 'link', kind: 'admin', href: '/admin/videos' });
    const [ext] = parseInline('[Docs](https://example.com/a)');
    expect(ext).toMatchObject({ t: 'link', kind: 'external' });
    expect(() => parseInline('[x](javascript:alert(1))')).toThrow(/link/i);
    expect(() => parseInline('[x](//evil.example)')).toThrow(/link/i);
  });

  it('never produces markup from angle brackets, they stay text', () => {
    expect(plainText(parseInline('a <script>x</script> b'))).toBe('a <script>x</script> b');
  });
});

describe('parseBlocks', () => {
  it('reads paragraphs, lists, images and callouts', () => {
    const blocks = parseBlocks(
      [
        'First paragraph',
        'continues here.',
        '',
        '1. Click **Upload**.',
        '   ![The Upload item in the menu](menu.webp)',
        '2. Choose a file.',
        '',
        '- one',
        '- two',
        '',
        '> [!TIP]',
        '> Use a wired connection.',
        '',
        '![Whole screen](screen.webp)',
      ].join('\n'),
    );
    expect(blocks.map((b) => b.t)).toEqual(['p', 'ol', 'ul', 'callout', 'image']);
    const ol = blocks[1];
    if (ol?.t !== 'ol') throw new Error('expected ol');
    expect(ol.items).toHaveLength(2);
    expect(ol.items[0]?.blocks).toEqual([
      { t: 'image', alt: 'The Upload item in the menu', src: 'menu.webp' },
    ]);
    expect(blocks[3]).toMatchObject({ t: 'callout', kind: 'tip' });
  });

  it('accepts the recorder layout and its comment markers', () => {
    const blocks = parseBlocks(
      [
        '<!-- kb:steps D02 -->',
        '1. Click Upload.',
        '   A short note.',
        '   ![Step 1](../../media/D02/D02-01-menu-desktop.webp)',
        '2. Drop the file.',
        '<!-- /kb:steps -->',
      ].join('\n'),
    );
    expect(blocks).toHaveLength(1);
    const ol = blocks[0];
    if (ol?.t !== 'ol') throw new Error('expected ol');
    expect(ol.items).toHaveLength(2);
    expect(plainText(ol.items[0]?.c ?? [])).toBe('Click Upload.');
    expect(plainText(ol.items[0]?.note ?? [])).toBe('A short note.');
    expect(ol.items[0]?.blocks[0]).toEqual({
      t: 'image',
      alt: 'Step 1',
      src: 'D02/D02-01-menu-desktop.webp',
    });
  });

  it('rejects image paths that climb out of the media folder', () => {
    expect(() => parseBlocks('![x](../secret.png)')).toThrow(/image/i);
    expect(() => parseBlocks('![x](https://example.com/a.png)')).toThrow(/image/i);
  });

  it('rejects a picture without alt text', () => {
    expect(() => parseBlocks('![](a.webp)')).toThrow(/alt/i);
  });
});
