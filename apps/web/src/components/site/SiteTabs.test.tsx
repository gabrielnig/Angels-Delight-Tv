// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SiteTabs } from './SiteTabs';

describe('SiteTabs', () => {
  it('lists Terms, Privacy, About and Help in order and marks the current one', () => {
    render(<SiteTabs current="privacy" />);
    const links = screen.getAllByRole('link');
    expect(links.map((l) => l.textContent)).toEqual(['Terms', 'Privacy', 'About', 'Help']);
    expect(screen.getByRole('link', { name: 'Privacy' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Terms' })).not.toHaveAttribute('aria-current');
    expect(screen.getByRole('link', { name: 'Help' })).toHaveAttribute('href', '/help');
  });
});
