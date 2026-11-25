// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { msg } from '@ad/shared/messages';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

import { BrowseControls } from './BrowseControls';
import { lengthOptions, sortOptions } from './browse-options';

const railItems = [
  { href: '/browse', label: 'All', current: true },
  { href: '/browse/science', label: 'Science', current: false },
];

function view(over: Partial<React.ComponentProps<typeof BrowseControls>> = {}) {
  return render(
    <BrowseControls
      base="/browse"
      length="any"
      sort="newest"
      railLabel="Categories"
      railItems={railItems}
      lengthOptions={lengthOptions(msg)}
      sortOptions={sortOptions(msg)}
      {...over}
    />,
  );
}

function phone(on: boolean) {
  window.matchMedia = ((q: string) => ({
    matches: on && q.includes('max-width'),
    media: q,
    addEventListener() {},
    removeEventListener() {},
  })) as never;
}
function scrollTo(y: number) {
  Object.defineProperty(window, 'scrollY', { configurable: true, value: y });
  fireEvent.scroll(window);
}

beforeEach(() => {
  push.mockReset();
  Object.defineProperty(window, 'scrollY', { configurable: true, value: 0 });
});
afterEach(() => {
  delete (window as unknown as Record<string, unknown>).matchMedia;
});

describe('BrowseControls (L11 slice 2)', () => {
  it('shows the rail and one bar with the Length and Sort buttons, no Clear while nothing is set', () => {
    view();
    expect(screen.getByRole('navigation', { name: 'Categories' })).toBeInTheDocument();
    const bar = screen.getByRole('group', { name: 'Filters' });
    expect(bar).toContainElement(screen.getByRole('button', { name: 'Length: Any length' }));
    expect(bar).toContainElement(screen.getByRole('button', { name: 'Sort by: Newest' }));
    expect(screen.queryByRole('link', { name: 'Clear length and sort' })).toBeNull();
  });

  it('keeps the choice in the URL: picking a length pushes the new address and keeps the sort', async () => {
    view({ sort: 'az', base: '/browse/science' });
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Length: Any length' }));
    await user.click(screen.getByRole('menuitemradio', { name: 'Over 15 min' }));
    expect(push).toHaveBeenCalledWith('/browse/science?length=long&sort=az');
  });

  it('picking a sort pushes the new address and keeps the length', async () => {
    view({ length: 'short' });
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Sort by: Newest' }));
    await user.click(screen.getByRole('menuitemradio', { name: 'Longest' }));
    expect(push).toHaveBeenCalledWith('/browse?length=short&sort=longest');
  });

  it('tints a set value and offers a Clear link that resets both', () => {
    view({ length: 'medium', sort: 'az', base: '/browse/science' });
    expect(screen.getByRole('button', { name: 'Length: 5 to 15 min' })).toHaveClass('is-set');
    expect(screen.getByRole('button', { name: 'Sort by: A to Z' })).toHaveClass('is-set');
    expect(screen.getByRole('link', { name: 'Clear length and sort' })).toHaveAttribute(
      'href',
      '/browse/science',
    );
  });

  describe('phone headroom', () => {
    const bar = () => document.querySelector('.web-browse-bar') as HTMLElement;
    const stuck = (top: number) => {
      const stack = document.querySelector('.web-browse-stack') as HTMLElement;
      stack.getBoundingClientRect = () => ({ top }) as DOMRect;
    };

    it('hides the bar on scroll down and brings it back on scroll up', () => {
      phone(true);
      view();
      stuck(0);
      expect(bar()).toHaveAttribute('data-hidden', 'false');
      act(() => scrollTo(300));
      act(() => scrollTo(400));
      expect(bar()).toHaveAttribute('data-hidden', 'true');
      act(() => scrollTo(350));
      expect(bar()).toHaveAttribute('data-hidden', 'false');
    });

    it('never hides before the rail has stuck, or on a desktop', () => {
      phone(true);
      view();
      stuck(200);
      act(() => scrollTo(50));
      act(() => scrollTo(120));
      expect(bar()).toHaveAttribute('data-hidden', 'false');
    });

    it('does not hide on a desktop width', () => {
      phone(false);
      view();
      stuck(0);
      act(() => scrollTo(300));
      act(() => scrollTo(500));
      expect(bar()).toHaveAttribute('data-hidden', 'false');
    });

    it('stays while a menu is open', async () => {
      phone(true);
      view();
      stuck(0);
      await userEvent.setup().click(screen.getByRole('button', { name: 'Length: Any length' }));
      act(() => scrollTo(300));
      act(() => scrollTo(600));
      expect(bar()).toHaveAttribute('data-hidden', 'false');
    });

    it('stays while focus is inside the bar, so keyboard users never lose their place', () => {
      phone(true);
      view();
      stuck(0);
      screen.getByRole('button', { name: 'Sort by: Newest' }).focus();
      act(() => scrollTo(300));
      act(() => scrollTo(600));
      expect(bar()).toHaveAttribute('data-hidden', 'false');
    });
  });

  it('marks the stack as stuck once it is pinned under the nav', () => {
    view();
    const stack = document.querySelector('.web-browse-stack') as HTMLElement;
    stack.getBoundingClientRect = () => ({ top: 0 }) as DOMRect;
    act(() => scrollTo(120));
    expect(stack).toHaveAttribute('data-stuck', 'true');
    stack.getBoundingClientRect = () => ({ top: 90 }) as DOMRect;
    act(() => scrollTo(0));
    expect(stack).toHaveAttribute('data-stuck', 'false');
  });
});
