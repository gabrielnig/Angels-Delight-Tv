// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@ad/ui';
import type { HomeData, VideoSummary, ViewerContext } from '../../lib/data';

const state = vi.hoisted(() => ({
  home: undefined as unknown,
  continueFails: false,
  listFails: false,
}));

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh() {}, push() {} }), usePathname: () => '/' }));
vi.mock('../../app/actions', () => ({
  reloadContinueRowAction: vi.fn(),
  reloadMyListRowAction: vi.fn(),
  restoreContinueAction: vi.fn(),
  removeContinueAction: vi.fn(),
  toggleMyListAction: vi.fn(),
  loadMoreHomeRowsAction: vi.fn(),
}));
vi.mock('../../lib/data', () => ({
  getCatalog: () => ({ home: async () => state.home }),
  getLibrary: () => ({
    continueWatching: async () => {
      if (state.continueFails) throw new Error('down');
      return [];
    },
    myList: async () => {
      if (state.listFails) throw new Error('down');
      return { items: [] };
    },
    myListIds: async () => [],
  }),
  getSite: () => ({ content: async () => ({ platformName: 'Angels Delight' }) }),
}));
vi.mock('../../lib/data/admin/theme-runtime', () => ({
  themeRuntime: async () => ({ settings: { get: async (key: string) => (key === 'home.view_all_label' ? 'View all' : true) } }),
}));
vi.mock('../../server/sponsors/surface-runtime', () => ({
  sponsorFor: async () => null,
  homeBannerRow: async () => 0,
}));

import { ConnectionStatus } from '../pwa/ConnectionStatus';
import { HomeView } from './HomeView';

const video = (n: number): VideoSummary => ({
  kind: 'video',
  id: `v${n}`,
  slug: `v${n}`,
  title: `Video ${n}`,
  description: `About ${n}`,
  durationSeconds: 300,
  categorySlug: 'health',
  categoryName: 'Health',
  hasCaptions: false,
  kidsSafe: true,
  publishedAt: '',
});
const ctx = (audience: 'adult' | 'kids' = 'adult') =>
  ({ audience, profileId: 'p1', guest: false }) as unknown as ViewerContext;
const data = (over: Partial<HomeData> = {}): HomeData => ({
  hero: [{ item: video(1) }],
  rows: [{ id: 'r1', title: 'Health', items: [video(2), video(3)] }],
  empty: false,
  ...over,
});
const show = async (c = ctx()) => {
  const view = await HomeView({ ctx: c });
  return render(<ToastProvider>{view}</ToastProvider>);
};

beforeEach(() => {
  state.continueFails = false;
  state.listFails = false;
  state.home = data();
  window.matchMedia = ((q: string) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {} })) as never;
});
afterEach(cleanup);

describe('HomeView states (M05-S01, S02, S08)', () => {
  it('shows the empty state when nothing is published', async () => {
    state.home = data({ hero: [], rows: [], empty: true });
    await show();
    expect(screen.getByRole('heading', { name: 'New videos are on the way' })).toBeTruthy();
  });

  it('keeps the shell of the page when the hero has no titles: a solid panel with a heading, and the rows', async () => {
    state.home = data({ hero: [] });
    const { container } = await show();
    const panel = container.querySelector('.ad-hero--fallback');
    expect(panel).not.toBeNull();
    expect(panel?.querySelector('h2')?.textContent).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Health' })).toBeTruthy();
  });

  it('leaves the other rows alone when Continue learning fails, and offers Try again', async () => {
    state.continueFails = true;
    await show();
    expect(screen.getByRole('button', { name: /Try again/i })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Health' })).toBeTruthy();
    expect(screen.getAllByText('Video 2').length).toBeGreaterThan(0);
  });

  it('leaves the other rows alone when My List fails', async () => {
    state.listFails = true;
    await show();
    expect(screen.getByRole('button', { name: /Try again/i })).toBeTruthy();
    expect(screen.getAllByText('Video 3').length).toBeGreaterThan(0);
  });

  it('draws the hero text in the page even when its image never loads', async () => {
    state.home = data({
      hero: [{ item: { ...video(1), thumbnail: { src: '/missing.webp', alt: '' } } }],
    });
    const { container } = await show();
    const img = container.querySelector('.ad-hero img')!;
    img.dispatchEvent(new Event('error'));
    expect(screen.getByRole('heading', { name: 'Video 1' })).toBeTruthy();
    expect(container.querySelector('.ad-hero__scrim')).not.toBeNull();
    expect(container.querySelector('.ad-hero')).not.toBeNull();
  });

  it('shows the kids home with the same hero and rows from kids titles', async () => {
    state.home = data({ hero: [{ item: { ...video(1), kidsSafe: true } }] });
    await show(ctx('kids'));
    expect(screen.getByRole('heading', { name: 'Video 1' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Health' })).toBeTruthy();
  });

  describe('hero sound button (M41-S22)', () => {
    const withClip = () =>
      data({
        hero: [
          {
            item: { ...video(1), kidsSafe: true },
            previewUrl: 'https://m.test/cap/a/preview/c.mp4',
            previewMs: 20_000,
            previewHasAudio: true,
          },
        ],
      });
    beforeEach(() => {
      Object.defineProperty(navigator, 'connection', {
        configurable: true,
        value: { effectiveType: '4g', downlink: 10, saveData: false },
      });
    });
    afterEach(() => Reflect.deleteProperty(navigator, 'connection'));

    it('offers Unmute on an adult profile when the clip has sound', async () => {
      state.home = withClip();
      await show(ctx('adult'));
      expect(screen.getByRole('button', { name: 'Unmute preview sound' })).toBeTruthy();
    });

    it('never offers it on a kids profile or the kids audience', async () => {
      state.home = withClip();
      await show(ctx('kids'));
      expect(screen.queryByRole('button', { name: /preview sound/ })).toBeNull();
    });
  });

  it('keeps the page and adds a saved view banner when the device goes offline', async () => {
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });
    try {
      const view = await HomeView({ ctx: ctx() });
      render(
        <ToastProvider>
          <ConnectionStatus savedView />
          {view}
        </ToastProvider>,
      );
      expect(screen.getByRole('status')).toHaveTextContent('Showing the view saved on this device');
      expect(screen.getByRole('heading', { name: 'Health' })).toBeTruthy();
      expect(screen.getByRole('heading', { name: 'Video 1' })).toBeTruthy();
    } finally {
      Reflect.deleteProperty(navigator, 'onLine');
    }
  });
});
