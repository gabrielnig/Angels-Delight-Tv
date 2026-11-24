import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Breadcrumbs } from './Breadcrumbs';

const trail = [
  { label: 'Admin', href: '/admin' },
  { label: 'Videos', href: '/admin/videos' },
  { label: 'Why the sky is blue' },
];

describe('Breadcrumbs', () => {
  it('has a navigation landmark named Breadcrumb', () => {
    render(<Breadcrumbs items={trail} />);
    expect(screen.getByRole('navigation', { name: 'Breadcrumb' })).toBeInTheDocument();
  });

  it('the last item is the current page and is not a link', () => {
    render(<Breadcrumbs items={trail} />);
    const nav = screen.getByRole('navigation', { name: 'Breadcrumb' });
    expect(within(nav).getAllByRole('link').map((a) => a.textContent)).toEqual(['Admin', 'Videos']);
    expect(within(nav).getByText('Why the sky is blue')).toHaveAttribute('aria-current', 'page');
  });

  it('a link given on the last item is ignored', () => {
    render(<Breadcrumbs items={[{ label: 'Admin', href: '/admin' }, { label: 'Here', href: '/x' }]} />);
    expect(screen.getAllByRole('link')).toHaveLength(1);
  });

  it('a single item renders as the current page', () => {
    render(<Breadcrumbs items={[{ label: 'Admin', href: '/admin' }]} />);
    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.getByText('Admin')).toHaveAttribute('aria-current', 'page');
  });

  it('a long current title carries the full text in the title attribute', () => {
    const long = 'A'.repeat(120);
    render(<Breadcrumbs items={[{ label: 'Admin', href: '/admin' }, { label: long }]} />);
    expect(screen.getByText(long)).toHaveAttribute('title', long);
  });

  it('uses the supplied link renderer for hrefs', () => {
    render(
      <Breadcrumbs
        items={trail}
        renderLink={({ href, children }) => (
          <a href={href} data-custom="yes">
            {children}
          </a>
        )}
      />,
    );
    expect(screen.getAllByRole('link').every((a) => a.getAttribute('data-custom') === 'yes')).toBe(true);
  });

  it('tone sets a modifier class', () => {
    render(<Breadcrumbs items={trail} tone="viewer" />);
    expect(screen.getByRole('navigation')).toHaveClass('ad-crumbs', 'ad-crumbs--viewer');
  });
});
