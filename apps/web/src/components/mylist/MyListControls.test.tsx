// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MyListControls, myListHref, parseMyListState } from './MyListControls';

const counts = { all: 5, started: 3, notStarted: 2 };

describe('my list controls (M44-S16)', () => {
  it('reads filter and sort from the URL and falls back on unknown values', () => {
    expect(parseMyListState({ filter: 'started', sort: 'az' })).toEqual({
      filter: 'started',
      sort: 'az',
    });
    expect(parseMyListState({ filter: 'nope', sort: ['za', 'az'] })).toEqual({
      filter: 'all',
      sort: 'newest',
    });
    expect(parseMyListState({})).toEqual({ filter: 'all', sort: 'newest' });
  });

  it('builds links that keep the other choice and omit defaults', () => {
    expect(myListHref({ filter: 'all', sort: 'newest' })).toBe('/my-list');
    expect(myListHref({ filter: 'started', sort: 'newest' })).toBe('/my-list?filter=started');
    expect(myListHref({ filter: 'not_started', sort: 'za' })).toBe(
      '/my-list?filter=not_started&sort=za',
    );
  });

  it('marks the current filter and sort and shows the counts', () => {
    render(<MyListControls state={{ filter: 'started', sort: 'az' }} counts={counts} />);
    expect(screen.getByRole('link', { name: /Started/ })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: /All/ })).not.toHaveAttribute('aria-current');
    expect(screen.getByRole('link', { name: /Started/ })).toHaveTextContent('3');
    expect(screen.getByRole('link', { name: 'A to Z' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Newest added' })).toHaveAttribute(
      'href',
      '/my-list?filter=started',
    );
  });
});
