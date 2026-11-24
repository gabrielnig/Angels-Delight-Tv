// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { ToastProvider } from '@ad/ui';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  viewer: { kind: 'guest', ctx: { guest: true, profileId: 'none', kids: false } } as unknown,
  guestPlay: true,
  title: vi.fn(),
  preview: vi.fn(),
  indexable: true,
  myListIds: vi.fn(async () => []),
}));
vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('notFound');
  },
  permanentRedirect: vi.fn(),
  usePathname: () => '/title/rain',
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), back: vi.fn() }),
}));
vi.mock('../../../../lib/session', () => ({ getViewerOrGuest: async () => mocks.viewer }));
vi.mock('../../../../server/guest/guest-settings', () => ({
  guestPlayEnabled: async () => mocks.guestPlay,
}));
vi.mock('../../../../lib/data', () => ({
  getSite: () => ({ content: async () => ({ signUpOpen: true }) }),
  getCatalog: () => ({
    title: mocks.title,
    publicPreview: (...args: unknown[]) => mocks.preview(...args),
  }),
  getLibrary: () => ({ myListIds: mocks.myListIds }),
}));
vi.mock('../../../../server/seo/page-seo', () => ({
  siteOrigin: () => 'https://example.test',
  titleIndexable: async () => mocks.indexable,
  shareConfig: async (title: string) => ({ channels: ['whatsapp'], text: title }),
}));
vi.mock('../../../../lib/theme/root', () => ({
  getRootTheme: async () => ({ platformName: 'x' }),
}));

import TitlePage, { generateMetadata } from './page';

const detail = {
  video: {
    id: 'v1',
    slug: 'rain',
    title: 'How rain is made',
    description: 'd',
    durationSeconds: 120,
    categorySlug: 'science',
    categoryName: 'Science',
    hasCaptions: false,
  },
  play: { label: 'play', startSeconds: 0 },
  progress: null,
  related: [],
  longDescription: 'long',
};

const page = async () =>
  render(
    <ToastProvider>{await TitlePage({ params: Promise.resolve({ slug: 'rain' }) })}</ToastProvider>,
  );

describe('title page for a guest', () => {
  beforeEach(() => {
    mocks.viewer = { kind: 'guest', ctx: { guest: true, profileId: 'none', kids: false } };
    mocks.guestPlay = true;
    mocks.title.mockResolvedValue(detail);
    mocks.preview.mockResolvedValue({
      type: 'video',
      item: { title: 'Preview', description: 'd', durationSeconds: 60, categoryName: 'Science' },
    });
    mocks.indexable = true;
    mocks.myListIds.mockClear();
  });

  it('shows Play and a My List button that opens the dialog, without reading a list', async () => {
    await page();
    for (const link of screen.getAllByRole('link', { name: 'Play' }))
      expect(link).toHaveAttribute('href', '/watch/v1');
    expect(screen.getByRole('button', { name: /My List/ })).toHaveAttribute(
      'aria-haspopup',
      'dialog',
    );
    expect(mocks.myListIds).not.toHaveBeenCalled();
  });

  it('shows the preview with Sign in to watch when guest play is off', async () => {
    mocks.guestPlay = false;
    await page();
    expect(screen.getByRole('link', { name: 'Sign in to watch' })).toBeInTheDocument();
    expect(mocks.title).not.toHaveBeenCalled();
  });
});

describe('title page search engine rules (M45-S02, R26)', () => {
  const params = { params: Promise.resolve({ slug: 'rain' }) };
  beforeEach(() => {
    mocks.viewer = { kind: 'guest', ctx: { guest: true, profileId: 'none', kids: false } };
    mocks.guestPlay = true;
    mocks.title.mockResolvedValue(detail);
    mocks.preview.mockResolvedValue({
      type: 'video',
      item: {
        slug: 'rain',
        title: 'Rain',
        description: 'd',
        durationSeconds: 60,
        categoryName: 'Science',
      },
    });
    mocks.indexable = true;
  });

  it('an unpublished or missing title asks not to be indexed', async () => {
    mocks.preview.mockResolvedValue(null);
    expect((await generateMetadata(params)).robots).toEqual({ index: false, follow: false });
  });

  it('a kids only title asks not to be indexed', async () => {
    mocks.indexable = false;
    expect((await generateMetadata(params)).robots).toEqual({ index: false, follow: false });
  });

  it('a title for everyone leaves robots alone', async () => {
    expect((await generateMetadata(params)).robots).toBeUndefined();
  });

  it('renders a breadcrumb and a video object as structured data', async () => {
    mocks.title.mockResolvedValue({
      ...detail,
      video: {
        ...detail.video,
        publishedAt: '2026-01-01T00:00:00.000Z',
        thumbnail: { src: '/p.webp' },
      },
    });
    const { container } = await page();
    const types = [...container.querySelectorAll('script[type="application/ld+json"]')].map(
      (el) => JSON.parse(el.textContent ?? '')['@type'],
    );
    expect(types).toEqual(['VideoObject', 'BreadcrumbList']);
  });

  it('renders no structured data for a kids only title', async () => {
    mocks.indexable = false;
    const { container } = await page();
    expect(container.querySelector('script[type="application/ld+json"]')).toBeNull();
  });
});
