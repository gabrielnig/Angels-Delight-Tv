// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EndScreen } from './EndScreen';

afterEach(cleanup);

const next = { id: 'v2', title: 'Why the Sky Is Blue', meta: 'Everyday Science, 5 min' };
const base = {
  data: { backHref: '/series/everyday-science', backLabel: 'Back to series' },
  next,
  countdown: null,
  countdownTotal: 5,
  cancelled: false,
  autoplayNext: true,
  stillWatching: false,
  onPlayNext: vi.fn(),
  onCancel: vi.fn(),
  onReplay: vi.fn(),
  onKeepWatching: vi.fn(),
  onStopAutoplay: vi.fn(),
};

describe('EndScreen (L4-08)', () => {
  it('shows the ring and the seconds left', () => {
    const { container } = render(<EndScreen {...base} countdown={4} countdownTotal={7} />);
    expect(screen.getByText('Up next in 4 seconds')).toBeTruthy();
    expect(container.querySelector('.adp-ring__n')?.textContent).toBe('4');
    const fill = container.querySelector('.adp-ring__fill')!;
    const c = 2 * Math.PI * 34;
    expect(Number(fill.getAttribute('stroke-dashoffset'))).toBeCloseTo(c * (1 - 4 / 7), 3);
  });

  it('ring is static under reduced motion', () => {
    const css = readFileSync(join(__dirname, '..', 'player.css'), 'utf8');
    const block =
      /@media \(prefers-reduced-motion: reduce\)\s*\{([\s\S]*?)\n\}\n/.exec(css)?.[1] ?? '';
    expect(block).toMatch(/\.adp \*[\s\S]*transition:\s*none !important/);
  });

  it('shows Play next and Back to series after cancel', () => {
    render(<EndScreen {...base} cancelled />);
    expect(screen.getByText('Autoplay cancelled')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Play next' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Back to series' }).getAttribute('href')).toBe(
      '/series/everyday-science',
    );
  });

  it('shows Replay and Back with no next title', () => {
    render(<EndScreen {...base} next={null} data={{ homeHref: '/' }} />);
    expect(screen.getByRole('button', { name: 'Replay' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Back to Home' })).toBeTruthy();
  });

  it('asks Still watching instead of counting down when three autoplays went unattended', () => {
    render(<EndScreen {...base} stillWatching />);
    expect(screen.getByRole('alertdialog', { name: 'Still watching?' })).toBeTruthy();
    expect(screen.queryByText(/Up next in/)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Keep watching' }));
    expect(base.onKeepWatching).toHaveBeenCalled();
  });
});
