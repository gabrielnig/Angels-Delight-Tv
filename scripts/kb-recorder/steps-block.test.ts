import { describe, expect, it } from 'vitest';
import type { Episode } from './episode';
import { applyStepsBlock, renderStepsBlock, shotFileName, stepList } from './steps-block';

const run = async () => {};
const episode: Episode = {
  id: 'D02',
  title: 'Upload one video',
  role: 'editor',
  steps: [
    { caption: 'Click Upload in the side menu.', run },
    {
      caption: 'Drag your video onto the box.',
      note: 'Files up to 2 GB work.',
      run,
      shot: { name: 'queue', alt: 'The Upload page with the drop box marked 1', marks: [] },
    },
    { caption: 'Wait until the row says Done.', run, shot: { name: 'done', marks: [] } },
  ],
};

describe('steps block generator', () => {
  it('numbers one line per step from the captions', () => {
    expect(stepList(episode).map((s) => s.text)).toEqual([
      'Click Upload in the side menu.',
      'Drag your video onto the box.',
      'Wait until the row says Done.',
    ]);
  });

  it('names screenshots like the media layout of the plan', () => {
    expect(shotFileName('D02', 2, 'queue', 'desktop')).toBe('D02-02-queue-desktop.webp');
    expect(shotFileName('D02', 12, 'a b', 'mobile')).toBe('D02-12-a-b-mobile.webp');
  });

  it('renders markers, numbered steps, notes and pictures with alt text', () => {
    const md = renderStepsBlock(episode);
    expect(md.startsWith('<!-- kb:steps D02 -->\n')).toBe(true);
    expect(md.trimEnd().endsWith('<!-- /kb:steps -->')).toBe(true);
    expect(md).toContain('1. Click Upload in the side menu.');
    expect(md).toContain('2. Drag your video onto the box.\n   Files up to 2 GB work.');
    expect(md).toContain(
      '![The Upload page with the drop box marked 1](../../media/D02/D02-02-queue-desktop.webp)',
    );
    expect(md).toContain(
      '![Step 3: Wait until the row says Done.](../../media/D02/D02-03-done-desktop.webp)',
    );
  });

  it('lets the caller choose the media prefix', () => {
    expect(renderStepsBlock(episode, { mediaPrefix: 'media' })).toContain(
      '(media/D02/D02-02-queue-desktop.webp)',
    );
  });

  it('replaces only the block between the markers', () => {
    const doc = 'intro\n\n<!-- kb:steps D02 -->\n1. old\n<!-- /kb:steps -->\n\nafter\n';
    const out = applyStepsBlock(doc, episode);
    expect(out).toContain('intro\n\n<!-- kb:steps D02 -->');
    expect(out).toContain('\n\nafter\n');
    expect(out).not.toContain('1. old');
  });

  it('fails clearly when the article has no markers for the flow', () => {
    expect(() => applyStepsBlock('no markers', episode)).toThrow(/kb:steps D02/);
  });

  it('is stable: applying twice gives the same text', () => {
    const doc = '<!-- kb:steps D02 -->\n<!-- /kb:steps -->\n';
    const once = applyStepsBlock(doc, episode);
    expect(applyStepsBlock(once, episode)).toBe(once);
  });
});

describe('dark by design pictures', () => {
  it('adds a dark suffix to the file name and the article link', () => {
    expect(shotFileName('S02', 1, 'card', 'desktop', 'dark')).toBe('S02-01-card-desktop-dark.webp');
    const e: Episode = {
      id: 'S02',
      title: 'T',
      role: 'none',
      steps: [
        { caption: 'Open the page.', run, shot: { name: 'card', scheme: 'dark', marks: [] } },
      ],
    };
    expect(renderStepsBlock(e)).toContain('S02-01-card-desktop-dark.webp');
  });
});
