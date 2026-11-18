// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const pathname = vi.hoisted(() => ({ value: '/account' }));
vi.mock('next/navigation', () => ({ usePathname: () => pathname.value }));

import { AccountNav, ACCOUNT_LINKS } from './AccountNav';

describe('AccountNav', () => {
  it('marks only the current page with aria-current', () => {
    pathname.value = '/account/security';
    render(<AccountNav />);
    const current = screen.getAllByRole('link').filter((a) => a.getAttribute('aria-current') === 'page');
    expect(current.map((a) => a.textContent)).toEqual(['Security']);
  });

  it('does not mark Overview as current on a child page', () => {
    pathname.value = '/account/data';
    render(<AccountNav />);
    expect(screen.getByRole('link', { name: 'Overview' })).not.toHaveAttribute('aria-current');
  });

  it('lists every account page with an icon that is hidden from readers', () => {
    pathname.value = '/settings/playback';
    const { container } = render(<AccountNav />);
    expect(screen.getAllByRole('link')).toHaveLength(ACCOUNT_LINKS.length);
    expect(container.querySelectorAll('a svg[aria-hidden="true"]')).toHaveLength(ACCOUNT_LINKS.length);
    expect(screen.getByRole('link', { name: 'Playback' })).toHaveAttribute('aria-current', 'page');
  });
});
