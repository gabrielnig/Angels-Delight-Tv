// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { HomeEmpty } from './HomeEmpty';

describe('HomeEmpty', () => {
  it('says new videos are on the way, names the platform and links to About', () => {
    render(<HomeEmpty platformName="Angels Delight" kids={false} />);
    expect(screen.getByRole('heading', { name: 'New videos are on the way' })).toBeInTheDocument();
    expect(screen.getByText(/Angels Delight/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'About' })).toHaveAttribute('href', '/about');
  });

  it('asks a child to get a grown-up when no kid titles exist', () => {
    render(<HomeEmpty platformName="Angels Delight" kids />);
    expect(
      screen.getByRole('heading', { name: 'Nothing here yet. Ask a grown-up to switch profile.' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'About' })).toBeNull();
  });
});
