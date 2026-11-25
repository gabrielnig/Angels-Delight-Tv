// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { PathView } from './PathView';
import { sampleLibrary } from './fixtures';

afterEach(cleanup);
const lib = sampleLibrary();

describe('PathView', () => {
  it('lists the guides in learning order with role, read time and what to read first', () => {
    render(<PathView library={lib} pathKey="daily" role="admin" showAll={false} />);
    expect(screen.getByRole('heading', { level: 1, name: 'Daily tasks' })).toBeInTheDocument();
    const items = within(screen.getByRole('list', { name: 'Guides in this path' })).getAllByRole(
      'listitem',
    );
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent('Title D01');
    expect(items[0]).toHaveTextContent('3 min read');
    expect(items[0]).toHaveTextContent('Read first: Title S01');
    expect(items[1]).toHaveTextContent('Title D02');
  });

  it('hides higher role guides with a count and shows them on request', () => {
    render(<PathView library={lib} pathKey="daily" role="editor" showAll={false} />);
    expect(screen.queryByText('Title D02')).toBeNull();
    expect(screen.getByRole('status')).toHaveTextContent('1 guide for a higher role is hidden');
    expect(screen.getByRole('link', { name: 'Show them' })).toHaveAttribute(
      'href',
      '/admin/help/path/daily?show=all',
    );
    cleanup();
    render(<PathView library={lib} pathKey="daily" role="editor" showAll />);
    expect(screen.getByText('Title D02')).toBeInTheDocument();
    expect(screen.getAllByText('Admin only').length).toBeGreaterThan(0);
  });
});
