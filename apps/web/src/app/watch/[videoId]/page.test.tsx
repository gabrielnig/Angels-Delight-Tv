import { describe, expect, it, vi } from 'vitest';

vi.mock('@ad/player/player.css', () => ({}));
vi.mock('@/features/player/watch.css', () => ({}));
vi.mock('@/app/actions', () => ({
  migrateDevicePrefsAction: vi.fn(),
  savePlayerPrefsAction: vi.fn(),
}));
vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => undefined }) }));
vi.mock('next/navigation', () => ({ notFound: () => undefined }));
vi.mock('@/lib/data/playback.server', () => ({
  getViewerContext: async () => ({ profileId: 'none', kids: false, guest: true }),
  getPlaybackData: () => ({
    getWatchData: async (id: string) =>
      id === 'ok' ? { status: 'ok', data: { video: { title: 'Rain' } } } : { status: 'not-found' },
  }),
  getProgressTransport: () => 'local',
  getTransport: () => 'http',
}));
vi.mock('@/server/player/player-settings', () => ({ playerCountdownSeconds: async () => 5 }));
vi.mock('@/features/player/WatchClient', () => ({ WatchClient: () => null }));
vi.mock('@/features/player/WatchDetails', () => ({ WatchDetails: () => null }));
vi.mock('@/features/player/UpNextList', () => ({ UpNextList: () => null }));

import { generateMetadata } from './page';

const props = (videoId: string) => ({
  params: Promise.resolve({ videoId }),
  searchParams: Promise.resolve({}),
});

describe('watch page metadata (M40-S17 AC3)', () => {
  it('marks every watch page noindex and nofollow, found or not', async () => {
    for (const id of ['ok', 'missing']) {
      const meta = await generateMetadata(props(id));
      expect(meta.robots).toEqual({ index: false, follow: false });
    }
  });

  it('keeps the video title', async () => {
    expect((await generateMetadata(props('ok'))).title).toBe('Rain');
  });
});
