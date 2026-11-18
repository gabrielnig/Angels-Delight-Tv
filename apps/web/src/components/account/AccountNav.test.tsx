// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const pathname = vi.hoisted(() => ({ value: '/account' }));
vi.mock('next/navigation', () => ({
  usePathname: () => pathname.value,
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
vi.mock('../../app/actions', () => ({ signOutAction: vi.fn() }));

import { AccountNav, ACCOUNT_LINKS } from './AccountNav';

describe('AccountNav (S27 to S31)', () => {
  it('uses the mockup labels in order', () => {
    pathname.value = '/account';
    render(<AccountNav />);
    expect(ACCOUNT_LINKS.map((l) => l.label)).toEqual([
      'Overview',
      'Security',
      'Playback settings',
      'Data and privacy',
    ]);
    expect(screen.getAllByRole('link').map((a) => a.textContent)).toEqual([
      'Overview',
      'Security',
      'Playback settings',
      'Data and privacy',
    ]);
  });

  it('marks only the current page with aria-current', () => {
    pathname.value = '/account/security';
    render(<AccountNav />);
    const current = screen
      .getAllByRole('link')
      .filter((a) => a.getAttribute('aria-current') === 'page');
    expect(current.map((a) => a.textContent)).toEqual(['Security']);
  });

  it('does not mark Overview as current on a child page', () => {
    pathname.value = '/account/data';
    render(<AccountNav />);
    expect(screen.getByRole('link', { name: 'Overview' })).not.toHaveAttribute('aria-current');
    expect(screen.getByRole('link', { name: 'Data and privacy' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('hides the icons from readers and keeps Sign out as a button after a rule', () => {
    pathname.value = '/settings/playback';
    const { container } = render(<AccountNav />);
    expect(container.querySelectorAll('svg:not([aria-hidden="true"])')).toHaveLength(0);
    expect(screen.getByRole('link', { name: 'Playback settings' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeInTheDocument();
    expect(container.querySelector('.acct-nav__rule')).not.toBeNull();
  });
});
