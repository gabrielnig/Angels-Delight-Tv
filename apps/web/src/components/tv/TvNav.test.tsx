// @vitest-environment jsdom
import { act, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const nav = vi.hoisted(() => ({ enabled: [] as boolean[], path: '/' }));
vi.mock('next/navigation', () => ({ usePathname: () => nav.path }));
vi.mock('../../lib/tv/useSpatialNav', () => ({
  useSpatialNav: ({ enabled }: { enabled: boolean }) => {
    nav.enabled.push(enabled);
  },
}));

import { TV_EVENT } from '../../lib/tv/client';
import { TvNav } from './TvNav';

const last = () => nav.enabled[nav.enabled.length - 1];

afterEach(() => {
  nav.enabled = [];
  nav.path = '/';
  document.documentElement.removeAttribute('data-tv');
});

describe('TvNav', () => {
  it('is off when the page is not in TV mode', () => {
    render(<TvNav />);
    expect(last()).toBe(false);
  });

  it('is on when html has data-tv', () => {
    document.documentElement.setAttribute('data-tv', 'on');
    render(<TvNav />);
    expect(last()).toBe(true);
  });

  it('is off on the watch page, which the player owns', () => {
    document.documentElement.setAttribute('data-tv', 'on');
    nav.path = '/watch/abc';
    render(<TvNav />);
    expect(last()).toBe(false);
  });

  it('follows the live switch', () => {
    render(<TvNav />);
    expect(last()).toBe(false);
    act(() => {
      document.documentElement.setAttribute('data-tv', 'on');
      window.dispatchEvent(new Event(TV_EVENT));
    });
    expect(last()).toBe(true);
  });
});
