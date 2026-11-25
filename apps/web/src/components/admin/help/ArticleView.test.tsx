// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ArticleView } from './ArticleView';
import { sampleLibrary } from './fixtures';

afterEach(cleanup);
const lib = sampleLibrary();

describe('ArticleView', () => {
  it('lays out the fixed sections in order with one h1', () => {
    render(<ArticleView library={lib} article={lib.byId.get('D01')!} role="editor" />);
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Title D01');
    const titles = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
    expect(titles).toEqual([
      'What you will do',
      'Before you start',
      'Steps',
      'What you should see',
      'If something goes wrong',
      'Related guides',
    ]);
  });

  it('shows steps as an ordered list with anchors', () => {
    render(<ArticleView library={lib} article={lib.byId.get('D01')!} role="editor" />);
    const list = screen.getByRole('list', { name: 'Steps' });
    expect(list.tagName).toBe('OL');
    expect(within(list).getAllByRole('listitem')).toHaveLength(2);
    expect(document.getElementById('step-2')).not.toBeNull();
  });

  it('prints who can do this from the permission table', () => {
    render(<ArticleView library={lib} article={lib.byId.get('D01')!} role="editor" />);
    const who = screen.getByRole('region', { name: 'Who can do this' });
    expect(within(who).getByText(/Upload videos/)).toBeInTheDocument();
    expect(within(who).getByText(/Admin and above/)).toBeInTheDocument();
  });

  it('labels a guide for a higher role and keeps it readable', () => {
    render(<ArticleView library={lib} article={lib.byId.get('D02')!} role="editor" />);
    expect(screen.getAllByText('Admin only').length).toBeGreaterThan(0);
    expect(screen.getByText('Editors can add, only Admins can remove.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Steps' })).toBeInTheDocument();
  });

  it('has a contents list, previous and next, and a release line for print', () => {
    render(<ArticleView library={lib} article={lib.byId.get('D01')!} role="editor" />);
    const toc = screen.getByRole('navigation', { name: 'On this page' });
    expect(within(toc).getByRole('link', { name: 'Steps' })).toHaveAttribute('href', '#steps');
    expect(within(toc).getByRole('link', { name: /1\. Click Go/ })).toHaveAttribute(
      'href',
      '#step-1',
    );
    expect(screen.getByRole('link', { name: /Next: Title D02/ })).toHaveAttribute(
      'href',
      '/admin/help/D02',
    );
    expect(screen.queryByRole('link', { name: /Previous:/ })).toBeNull();
    expect(screen.getByText(/Help centre, guide D01/)).toBeInTheDocument();
    expect(screen.getByText(/Not yet checked against a release/)).toBeInTheDocument();
  });

  it('links the previous guide inside the same path', () => {
    render(<ArticleView library={lib} article={lib.byId.get('D02')!} role="admin" />);
    expect(screen.getByRole('link', { name: /Previous: Title D01/ })).toHaveAttribute(
      'href',
      '/admin/help/D01',
    );
  });

  it('offers Go to this screen only for a screen that has a fixed address', () => {
    render(<ArticleView library={lib} article={lib.byId.get('D01')!} role="editor" />);
    expect(screen.getByRole('link', { name: /Go to this screen/ })).toHaveAttribute(
      'href',
      '/admin/videos/upload',
    );
    cleanup();
    render(<ArticleView library={lib} article={lib.byId.get('D02')!} role="admin" />);
    expect(screen.queryByRole('link', { name: /Go to this screen/ })).toBeNull();
  });

  it('shows the print button', () => {
    render(<ArticleView library={lib} article={lib.byId.get('D01')!} role="editor" />);
    expect(screen.getByRole('button', { name: /Print or save as PDF/ })).toBeInTheDocument();
  });
});
