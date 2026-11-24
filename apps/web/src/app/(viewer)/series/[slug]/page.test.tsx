// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  series: vi.fn(),
  preview: vi.fn(),
  indexable: true,
}));
vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('notFound');
  },
  permanentRedirect: vi.fn(),
}));
vi.mock('../../../../lib/session', () => ({
  getViewerOrGuest: async () => ({ kind: 'guest', ctx: { guest: true, profileId: 'none' } }),
}));
vi.mock('../../../../server/guest/guest-settings', () => ({ guestPlayEnabled: async () => true }));
vi.mock('../../../../server/seo/page-seo', () => ({
  siteOrigin: () => 'https://example.test',
  titleIndexable: async () => mocks.indexable,
  shareConfig: async (title: string) => ({ channels: ['whatsapp'], text: title }),
}));
vi.mock('../../../../lib/data', () => ({
  getSite: () => ({ content: async () => ({ signUpOpen: true }) }),
  getCatalog: () => ({ series: mocks.series, publicPreview: mocks.preview }),
  getLibrary: () => ({ myListIds: async () => [] }),
}));
vi.mock('../../../../lib/theme/root', () => ({
  getRootTheme: async () => ({ platformName: 'ADTV' }),
}));
vi.mock('../../../../components/Shell', () => ({
  AppShell: ({ children }: { children: unknown }) => <>{children as never}</>,
}));
vi.mock('../../../../components/title/TitleActions', () => ({ TitleActions: () => null }));
vi.mock('../../../../components/guest/GuestEpisodeProgress', () => ({
  GuestEpisodeProgress: () => null,
}));
vi.mock('../../../../components/title/EpisodeList', () => ({ EpisodeList: () => null }));

import SeriesPage, { generateMetadata } from './page';

const params = { params: Promise.resolve({ slug: 'money' }) };
const summary = {
  kind: 'series',
  slug: 'money',
  title: 'Money 101',
  description: 'Basics.',
  categorySlug: 'money',
  categoryName: 'Money',
  episodeCount: 1,
  seasonCount: 1,
  kidsSafe: false,
  hasCaptions: false,
  publishedAt: '2026-01-01T00:00:00Z',
};

describe('series page search engine rules (M45-S02, R26)', () => {
  beforeEach(() => {
    mocks.indexable = true;
    mocks.preview.mockResolvedValue({ type: 'series', item: summary });
    mocks.series.mockResolvedValue({
      series: summary,
      seasons: [
        {
          number: 1,
          episodes: [
            {
              number: 1,
              video: { id: 'e1', title: 'First', slug: 'first' },
              progress: undefined,
              watched: false,
              current: true,
              blurb: '',
            },
          ],
        },
      ],
      next: { videoId: 'e1', season: 1, episode: 1, resume: false, label: 'play' },
    });
  });

  it('a missing series asks not to be indexed', async () => {
    mocks.preview.mockResolvedValue(null);
    expect((await generateMetadata(params)).robots).toEqual({ index: false, follow: false });
  });

  it('a kids only series asks not to be indexed', async () => {
    mocks.indexable = false;
    expect((await generateMetadata(params)).robots).toEqual({ index: false, follow: false });
  });

  it('renders a TVSeries and a breadcrumb', async () => {
    const { container } = render(
      await SeriesPage({ ...params, searchParams: Promise.resolve({}) }),
    );
    const types = [...container.querySelectorAll('script[type="application/ld+json"]')].map(
      (el) => JSON.parse(el.textContent ?? '')['@type'],
    );
    expect(types).toEqual(['TVSeries', 'BreadcrumbList']);
  });

  it('renders no structured data for a kids only series', async () => {
    mocks.indexable = false;
    const { container } = render(
      await SeriesPage({ ...params, searchParams: Promise.resolve({}) }),
    );
    expect(container.querySelector('script[type="application/ld+json"]')).toBeNull();
  });
});
