// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { ToastProvider } from '@ad/ui';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  viewer: { kind: 'guest', ctx: { guest: true, profileId: 'none', kids: false } } as unknown,
  guestPlay: true,
  title: vi.fn(),
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
    publicPreview: async () => ({
      type: 'video',
      item: { title: 'Preview', description: 'd', durationSeconds: 60, categoryName: 'Science' },
    }),
  }),
  getLibrary: () => ({ myListIds: mocks.myListIds }),
}));
vi.mock('../../../../lib/seo', () => ({ previewMetadata: () => ({}) }));
vi.mock('../../../../lib/theme/root', () => ({
  getRootTheme: async () => ({ platformName: 'x' }),
}));

import TitlePage from './page';

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
