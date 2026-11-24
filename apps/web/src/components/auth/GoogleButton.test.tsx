// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { GoogleButton } from './GoogleButton';
import { SocialButtons } from './SocialButtons';

const css = readFileSync(resolve(import.meta.dirname, 'google-button.css'), 'utf8');

describe('GoogleButton', () => {
  it('is a link with the exact label, and the sign up page says Sign up with Google', () => {
    const { rerender } = render(<GoogleButton href="/api/auth/google/start" />);
    const link = screen.getByRole('link', { name: 'Continue with Google' });
    expect(link).toHaveAttribute('href', '/api/auth/google/start');
    rerender(<GoogleButton href="/api/auth/google/start" variant="signUp" />);
    expect(screen.getByRole('link', { name: 'Sign up with Google' })).toBeInTheDocument();
  });

  it('keeps the brand mark inside its own decorative svg', () => {
    render(<GoogleButton href="/x" />);
    const mark = document.querySelector('svg');
    expect(mark).toHaveAttribute('aria-hidden', 'true');
    expect(mark?.getAttribute('width')).toBe('20');
    const fills = [...(mark?.querySelectorAll('path') ?? [])].map((p) => p.getAttribute('fill'));
    expect(fills).toEqual(['#EA4335', '#4285F4', '#FBBC05', '#34A853']);
  });

  it('disables itself while redirecting and says so, size locked by the same element', async () => {
    const user = userEvent.setup();
    render(<GoogleButton href="/x" />);
    const link = screen.getByRole('link', { name: 'Continue with Google' });
    link.addEventListener('click', (event) => event.preventDefault());
    await user.click(link);
    const busy = screen.getByRole('link', { name: 'Opening Google' });
    expect(busy).toHaveAttribute('aria-disabled', 'true');
    expect(busy).toHaveAttribute('data-redirecting', 'true');
    let prevented = false;
    busy.addEventListener('click', (event) => {
      prevented = event.defaultPrevented;
    });
    await user.click(busy);
    expect(prevented).toBe(true);
  });
});

describe('google-button.css (DESIGN-SYSTEM 11.26)', () => {
  it('uses only the three documented literal colours', () => {
    const literals = (css.match(/#[0-9a-f]{3,8}\b|rgba?\(/gi) ?? []).map((c) => c.toLowerCase());
    expect([...new Set(literals)].sort()).toEqual(['#1f1f1f', '#747775', '#ffffff']);
  });

  it('is 48px tall with a 44px floor, full width, medium weight in the sans family', () => {
    expect(css).toMatch(/min-height:\s*48px/);
    expect(css).toMatch(/font-weight:\s*500/);
    expect(css).toMatch(/font-family:\s*var\(--font-sans\)/);
    expect(css).toMatch(/inline-size:\s*100%/);
  });

  it('focus uses a 3px ring with a 2px offset and never removes the outline', () => {
    expect(css).toMatch(
      /\.google-btn:focus-visible\s*\{[^}]*outline:\s*3px solid var\(--color-focus-ring\)/,
    );
    expect(css).toMatch(/outline-offset:\s*2px/);
    expect(css).not.toMatch(/outline:\s*(none|0)/);
  });

  it('hover lives inside the hover and fine pointer query', () => {
    const query = /@media \(hover: hover\) and \(pointer: fine\)\s*\{([\s\S]*?)\n\}/.exec(css);
    expect(query?.[1]).toMatch(/\.google-btn:hover/);
    const outside = css.replace(query?.[0] ?? '', '');
    expect(outside).not.toMatch(/:hover/);
  });

  it('stops the spinner for reduced motion', () => {
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)\s*\{[^}]*animation:\s*none/);
  });
});

describe('SocialButtons', () => {
  it('renders nothing when Google is not configured', () => {
    const { container } = render(<SocialButtons google={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the or divider and the button when configured', () => {
    render(<SocialButtons google={{ href: '/api/auth/google/start' }} />);
    expect(screen.getByText('or')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Continue with Google' })).toBeInTheDocument();
  });

  it('passes next into the start link', () => {
    render(<SocialButtons google={{ href: '/api/auth/google/start' }} next="/library" />);
    expect(screen.getByRole('link', { name: 'Continue with Google' })).toHaveAttribute(
      'href',
      '/api/auth/google/start?next=%2Flibrary',
    );
  });
});
