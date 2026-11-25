// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { buildLibrary, parseGlossary } from '@ad/help';
import { GlossaryView } from './GlossaryView';
import { article } from './fixtures';

afterEach(cleanup);
const terms = parseGlossary(`## Poster
The picture shown before a video plays.
Guides: D01
Aliases: thumbnail

## Caption
Words on screen for what is said.

## Zone
A made up term.
`);
const lib = buildLibrary([article('S01', 'start'), article('D01', 'daily', 'needs: [S01]')], terms);

describe('GlossaryView', () => {
  it('lists terms A to Z with anchors by slug and an A to Z jump bar of the letters in use', () => {
    render(<GlossaryView library={lib} role="editor" />);
    const jump = screen.getByRole('navigation', { name: 'Jump to a letter' });
    expect(
      within(jump)
        .getAllByRole('link')
        .map((l) => l.textContent),
    ).toEqual(['C', 'P', 'Z']);
    expect(document.getElementById('poster')).not.toBeNull();
    const headings = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent);
    expect(headings).toEqual(['Caption', 'Poster', 'Zone']);
  });

  it('is a list of terms, not a definition list with wrapper blocks (axe definition-list)', () => {
    const { container } = render(<GlossaryView library={lib} role="editor" />);
    expect(container.querySelector('dl')).toBeNull();
    const lists = container.querySelectorAll('ul.hlp-gloss-list');
    expect(lists.length).toBe(3);
    for (const list of lists) {
      for (const child of Array.from(list.children)) expect(child.tagName).toBe('LI');
    }
  });

  it('links each term to its guides and shows alternative words', () => {
    render(<GlossaryView library={lib} role="editor" />);
    expect(screen.getByRole('link', { name: 'Title D01' })).toHaveAttribute(
      'href',
      '/admin/help/D01',
    );
    expect(screen.getByText(/thumbnail/)).toBeInTheDocument();
  });

  it('has a filter box that works without script and an empty state', () => {
    render(<GlossaryView library={lib} role="editor" filter="nothing" />);
    expect(screen.getByRole('searchbox', { name: 'Filter terms' })).toHaveValue('nothing');
    expect(screen.getByRole('heading', { name: /No terms match/ })).toBeInTheDocument();
  });

  it('filters by term or alternative word', () => {
    render(<GlossaryView library={lib} role="editor" filter="thumb" />);
    expect(screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual([
      'Poster',
    ]);
  });
});
