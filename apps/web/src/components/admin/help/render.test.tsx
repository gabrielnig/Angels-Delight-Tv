// @vitest-environment jsdom
import { parseBlocks, parseInline } from '@ad/help';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Blocks, Inlines, mediaUrl } from './render';

afterEach(cleanup);

describe('Inlines', () => {
  it('marks a link to another guide with its id so the print copy can show it', () => {
    render(
      <p>
        <Inlines nodes={parseInline('[Fix](help:T01#step-2) [Videos](/admin/videos)')} />
      </p>,
    );
    expect(screen.getByRole('link', { name: 'Fix' })).toHaveAttribute('data-guide', 'T01');
    expect(screen.getByRole('link', { name: 'Videos' })).not.toHaveAttribute('data-guide');
  });

  it('links guides, glossary terms and admin screens inside the app, and external links safely', () => {
    render(
      <p>
        <Inlines
          nodes={parseInline(
            '[Fix](help:T01#step-2) [term](glossary:caption) [Videos](/admin/videos) [Site](https://example.org)',
          )}
        />
      </p>,
    );
    expect(screen.getByRole('link', { name: 'Fix' })).toHaveAttribute(
      'href',
      '/admin/help/T01#step-2',
    );
    expect(screen.getByRole('link', { name: 'term' })).toHaveAttribute(
      'href',
      '/admin/help/glossary#caption',
    );
    expect(screen.getByRole('link', { name: 'Videos' })).toHaveAttribute('href', '/admin/videos');
    const ext = screen.getByRole('link', { name: /Site/ });
    expect(ext).toHaveAttribute('rel', 'noreferrer noopener');
    expect(ext).toHaveAttribute('target', '_blank');
  });

  it('shows labels in bold and never turns angle brackets into markup', () => {
    const { container } = render(
      <p>
        <Inlines nodes={parseInline('Click **Upload** <b>x</b>')} />
      </p>,
    );
    expect(container.querySelector('strong')?.textContent).toBe('Upload');
    expect(container.querySelector('b')).toBeNull();
    expect(container.textContent).toContain('<b>x</b>');
  });
});

describe('Blocks', () => {
  it('draws pictures from the private media route with their alt text and callouts with a word', () => {
    render(
      <Blocks
        blocks={parseBlocks(
          '![Upload in the menu](../../media/D02/D02-01-menu-desktop.webp)\n\n> [!CAREFUL]\n> Keep this page open.',
        )}
      />,
    );
    const img = screen.getByRole('img', { name: 'Upload in the menu' });
    expect(img).toHaveAttribute('src', '/admin/help/media/img/D02/D02-01-menu-desktop.webp');
    expect(img).toHaveAttribute('loading', 'lazy');
    expect(screen.getByText('Careful:')).toBeInTheDocument();
    expect(screen.getByText('Keep this page open.')).toBeInTheDocument();
  });
});

describe('mediaUrl', () => {
  it('maps a media relative path to the route', () => {
    expect(mediaUrl('S04/S04-01-menu-desktop.webp')).toBe(
      '/admin/help/media/img/S04/S04-01-menu-desktop.webp',
    );
  });
});
