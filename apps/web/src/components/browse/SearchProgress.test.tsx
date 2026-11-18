// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SearchProgress } from './SearchProgress';

describe('SearchProgress (M06-S09)', () => {
  it('shows a named progress line while new results load', () => {
    render(<SearchProgress active />);
    const bar = screen.getByRole('progressbar', { name: 'Loading results' });
    expect(bar).toBeInTheDocument();
    expect(bar).not.toHaveAttribute('aria-valuenow');
  });
  it('shows nothing to assistive tech when idle, but keeps its height so the page does not jump', () => {
    const { container } = render(<SearchProgress active={false} />);
    expect(screen.queryByRole('progressbar')).toBeNull();
    expect(container.querySelector('.web-search-progress')).not.toBeNull();
  });
});
