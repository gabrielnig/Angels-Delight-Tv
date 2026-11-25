// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { SearchView } from './SearchView';
import { sampleLibrary } from './fixtures';

afterEach(cleanup);
const lib = sampleLibrary();

describe('SearchView', () => {
  it('shows a labelled search box and the tips when nothing was asked yet', () => {
    render(<SearchView library={lib} query="" role="editor" showAll={false} />);
    expect(screen.getByRole('searchbox', { name: 'Search the help centre' })).toHaveValue('');
    expect(screen.getByText(/Try a plain word/)).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Search results' })).toBeNull();
  });

  it('lists matches with the searched word marked and a count', () => {
    render(<SearchView library={lib} query="Title D01" role="editor" showAll={false} />);
    const list = screen.getByRole('list', { name: 'Search results' });
    const first = within(list).getAllByRole('listitem')[0]!;
    expect(first).toHaveTextContent('Title D01');
    expect(first.querySelector('mark')).not.toBeNull();
    expect(within(first).getByRole('link', { name: /Title D01/ })).toHaveAttribute(
      'href',
      '/admin/help/D01',
    );
    expect(screen.getByRole('status')).toHaveTextContent(/\d+ guides? found/);
  });

  it('labels higher role guides and keeps them after the ones the person can do', () => {
    render(<SearchView library={lib} query="Title" role="editor" showAll={false} />);
    const items = screen.getAllByRole('listitem');
    const labelled = items.filter((i) => /Admin only|Super admin only/.test(i.textContent ?? ''));
    expect(labelled.length).toBeGreaterThan(0);
    expect(items[items.length - 1]).toHaveTextContent(/only/);
  });

  it('explains an empty result and offers the browse paths and a suggestion', () => {
    render(<SearchView library={lib} query="zzzzzz" role="editor" showAll={false} />);
    expect(screen.getByRole('heading', { name: /No guides match/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Browse all guides' })).toHaveAttribute(
      'href',
      '/admin/help',
    );
  });

  it('suggests a corrected word as a link', () => {
    render(<SearchView library={lib} query="titel" role="editor" showAll={false} />);
    expect(screen.getByRole('link', { name: 'title' })).toHaveAttribute(
      'href',
      '/admin/help/search?q=title',
    );
  });
});
