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

  it('shows Add your first video only to people who can upload', () => {
    const { rerender } = render(<HomeEmpty platformName="Angels Delight" kids={false} canUpload />);
    expect(screen.getByRole('link', { name: 'Add your first video' })).toHaveAttribute(
      'href',
      '/admin/videos/upload',
    );
    rerender(<HomeEmpty platformName="Angels Delight" kids={false} />);
    expect(screen.queryByRole('link', { name: 'Add your first video' })).toBeNull();
  });

  it('never shows the upload link on a kids profile', () => {
    render(<HomeEmpty platformName="Angels Delight" kids canUpload />);
    expect(screen.queryByRole('link', { name: 'Add your first video' })).toBeNull();
  });

  it('asks a child to get a grown-up when no kid titles exist', () => {
    render(<HomeEmpty platformName="Angels Delight" kids />);
    expect(
      screen.getByRole('heading', { name: 'Nothing here yet. Ask a grown-up to switch profile.' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'About' })).toBeNull();
  });
});
