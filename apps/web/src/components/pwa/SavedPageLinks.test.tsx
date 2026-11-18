// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SavedPageLinks } from './SavedPageLinks';

const pages = [
  { href: '/about', label: 'About' },
  { href: '/help', label: 'Help' },
];

describe('SavedPageLinks (M25-S04)', () => {
  it('links only to pages that are saved on this device', async () => {
    const has = async (href: string) => href === '/help';
    render(<SavedPageLinks pages={pages} has={has} />);
    expect(await screen.findByRole('link', { name: 'Help' })).toHaveAttribute('href', '/help');
    expect(screen.queryByRole('link', { name: 'About' })).toBeNull();
    expect(screen.getByRole('navigation', { name: 'Pages saved on this device' })).toBeTruthy();
  });

  it('renders nothing when no page is saved', async () => {
    const { container } = render(<SavedPageLinks pages={pages} has={async () => false} />);
    await waitFor(() => expect(container.querySelector('nav')).toBeNull());
  });
});
