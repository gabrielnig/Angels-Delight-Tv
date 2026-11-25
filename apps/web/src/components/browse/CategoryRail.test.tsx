// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { CategoryRail, type RailItem } from './CategoryRail';

const items: RailItem[] = [
  { href: '/browse', label: 'All', current: false },
  { href: '/browse/science', label: 'Science', current: false },
  { href: '/browse/maths', label: 'Maths', current: true },
  { href: '/browse/health', label: 'Health', current: false },
];

function geometry(scroller: HTMLElement, opts: { client: number; scroll: number; left?: number }) {
  Object.defineProperty(scroller, 'clientWidth', { configurable: true, value: opts.client });
  Object.defineProperty(scroller, 'scrollWidth', { configurable: true, value: opts.scroll });
  scroller.scrollLeft = opts.left ?? 0;
}

describe('CategoryRail (L11 slice 1)', () => {
  it('is a labelled nav with one list of links and aria-current on the selected chip', () => {
    render(<CategoryRail label="Categories" items={items} />);
    const nav = screen.getByRole('navigation', { name: 'Categories' });
    expect(nav.querySelectorAll('li')).toHaveLength(4);
    expect(screen.getByRole('link', { name: 'Maths' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Science' })).not.toHaveAttribute('aria-current');
  });

  it('keeps every chip a link in the natural tab order with no roving tabindex', async () => {
    render(<CategoryRail label="Categories" items={items} />);
    const user = userEvent.setup();
    // The arrow buttons are hidden until the rail can scroll, so start from the first chip.
    screen.getByRole('link', { name: 'All' }).focus();
    await user.tab();
    expect(screen.getByRole('link', { name: 'Science' })).toHaveFocus();
    for (const link of screen.getAllByRole('link')) expect(link).not.toHaveAttribute('tabindex');
  });

  it('names the arrow buttons and keeps them out of the way until the rail can scroll', () => {
    const { container } = render(<CategoryRail label="Categories" items={items} />);
    const prev = screen.getByRole('button', { name: 'Previous categories', hidden: true });
    const next = screen.getByRole('button', { name: 'Next categories', hidden: true });
    expect(prev).toHaveAttribute('type', 'button');
    expect(next).toHaveAttribute('type', 'button');
    const root = container.querySelector('.web-rail') as HTMLElement;
    expect(root).not.toHaveClass('can-start');
    expect(root).not.toHaveClass('can-end');
  });

  it('marks which edge has more chips as the rail scrolls', () => {
    const { container } = render(<CategoryRail label="Categories" items={items} />);
    const root = container.querySelector('.web-rail') as HTMLElement;
    const scroller = container.querySelector('.web-rail__scroller') as HTMLElement;
    geometry(scroller, { client: 300, scroll: 900, left: 0 });
    fireEvent.scroll(scroller);
    expect(root).not.toHaveClass('can-start');
    expect(root).toHaveClass('can-end');
    geometry(scroller, { client: 300, scroll: 900, left: 300 });
    fireEvent.scroll(scroller);
    expect(root).toHaveClass('can-start');
    expect(root).toHaveClass('can-end');
    geometry(scroller, { client: 300, scroll: 900, left: 600 });
    fireEvent.scroll(scroller);
    expect(root).toHaveClass('can-start');
    expect(root).not.toHaveClass('can-end');
  });

  it('pages by most of a screenful when an arrow is pressed', async () => {
    const { container } = render(<CategoryRail label="Categories" items={items} />);
    const scroller = container.querySelector('.web-rail__scroller') as HTMLElement;
    geometry(scroller, { client: 500, scroll: 1500 });
    const calls: Array<{ left?: number }> = [];
    scroller.scrollBy = ((o: { left?: number }) => calls.push(o)) as never;
    await userEvent.setup().click(screen.getByRole('button', { name: 'Next categories', hidden: true }));
    await userEvent.setup().click(screen.getByRole('button', { name: 'Previous categories', hidden: true }));
    expect(calls.map((c) => c.left)).toEqual([400, -400]);
  });

  it('scrolls the selected chip into view when it mounts, without moving the page', () => {
    const originals = {
      client: Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth'),
      offsetLeft: Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetLeft'),
      offsetWidth: Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetWidth'),
    };
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, value: 300 });
    Object.defineProperty(HTMLElement.prototype, 'offsetLeft', { configurable: true, value: 700 });
    Object.defineProperty(HTMLElement.prototype, 'offsetWidth', { configurable: true, value: 100 });
    try {
      const { container } = render(<CategoryRail label="Categories" items={items} />);
      const scroller = container.querySelector('.web-rail__scroller') as HTMLElement;
      // centre of the chip (750) minus half the rail (150)
      expect(scroller.scrollLeft).toBe(600);
    } finally {
      for (const [prop, d] of [
        ['clientWidth', originals.client],
        ['offsetLeft', originals.offsetLeft],
        ['offsetWidth', originals.offsetWidth],
      ] as const) {
        if (d) Object.defineProperty(HTMLElement.prototype, prop, d);
        else delete (HTMLElement.prototype as unknown as Record<string, unknown>)[prop];
      }
    }
  });

  it('does not wrap, and shows arrows on fine pointers only (stylesheet contract)', () => {
    const css = readFileSync(resolve(__dirname, 'browse-rail.css'), 'utf8');
    expect(css).toMatch(/\.web-rail__scroller\s*\{[^}]*flex-wrap:\s*nowrap/);
    expect(css).toMatch(/\.web-rail__scroller\s*\{[^}]*overflow-x:\s*auto/);
    expect(css).toMatch(/scroll-snap-type:\s*x proximity/);
    expect(css).toMatch(/scroll-padding-inline:/);
    expect(css).toMatch(/\.web-rail__link\s*\{[^}]*min-height:\s*var\(--touch-target\)/);
    expect(css).toMatch(/@media \(hover: hover\) and \(pointer: fine\)/);
    const arrowDefault = css.match(/\.web-rail__arrow\s*\{[^}]*\}/)?.[0] ?? '';
    expect(arrowDefault).toMatch(/display:\s*none/);
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });

  it('states are drawn: focus ring, selected, reduced motion', () => {
    const css = readFileSync(resolve(__dirname, 'browse-rail.css'), 'utf8');
    expect(css).toMatch(/:focus-visible/);
    expect(css).toMatch(/--color-focus-ring/);
    expect(css).toMatch(/aria-current='page'/);
    expect(css).toMatch(/prefers-reduced-motion/);
  });
});
