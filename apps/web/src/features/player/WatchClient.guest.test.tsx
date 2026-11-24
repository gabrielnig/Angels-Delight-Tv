// @vitest-environment jsdom
import { FakeEngine, FakeNetwork } from '@ad/player/testing';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createFixturePlaybackData } from '@/lib/data/playback.fixture';
import type { WatchData } from '@/lib/data/playback';
import { GUEST_PROGRESS_KEY, readGuestProgress } from '@/lib/guest/progress-store';
import { captionStyleKey } from './preferences';
import { WatchClient } from './WatchClient';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

const VIDEO = '0192f0a0-0000-7000-8000-0000000000aa';
const guest = { profileId: 'none', kids: false, guest: true as const };

async function dataFor(id: string): Promise<WatchData> {
  const r = await createFixturePlaybackData().getWatchData(id, { profileId: 'p1', kids: false });
  if (r.status !== 'ok') throw new Error('fixture missing');
  return { ...r.data, saved: null, video: { ...r.data.video, id: VIDEO } };
}

function sessionResponse() {
  return new Response(
    JSON.stringify({
      token: 'guest-token',
      expiresAt: new Date(Date.now() + 1_800_000).toISOString(),
      masterUrl: `/api/play/${VIDEO}/master.m3u8`,
    }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  );
}

function mount(data: WatchData, prefsSync = { save: vi.fn(), migrate: vi.fn() }) {
  const engine = new FakeEngine();
  const utils = render(
    <WatchClient
      data={data}
      viewer={guest}
      transport="http"
      progressTransport="http"
      startAt={null}
      prefsSync={prefsSync as never}
      testing={{ createEngine: async () => engine, network: new FakeNetwork() }}
    >
      <h1>{data.video.title}</h1>
    </WatchClient>,
  );
  return { engine, prefsSync, ...utils };
}

describe('WatchClient for a guest (M40-S02, S04)', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    localStorage.clear();
    push.mockClear();
    fetchMock = vi.fn(async () => sessionResponse());
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => undefined);
    vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => undefined);
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('asks for a session with no profile id and with credentials', async () => {
    const { engine } = mount(await dataFor('v-rain'));
    await waitFor(() => expect(engine.loads).toHaveLength(1));
    const call = fetchMock.mock.calls.find(([url]) => String(url).endsWith('/session'))!;
    expect(String(call[0])).toContain(`/api/play/${VIDEO}/session`);
    const init = call[1] as RequestInit;
    expect(JSON.parse(init.body as string)).toEqual({});
    expect(init.credentials).toBe('include');
    expect(engine.tokens).toContain('guest-token');
  });

  it('never calls prefsSync and never posts to /api/progress', async () => {
    const { engine, prefsSync } = mount(await dataFor('v-rain'));
    await waitFor(() => expect(engine.loads).toHaveLength(1));
    const video = document.querySelector('video')!;
    Object.defineProperty(video, 'currentTime', { value: 42, configurable: true, writable: true });
    Object.defineProperty(video, 'duration', { value: 300, configurable: true });
    video.dispatchEvent(new Event('pause'));
    await waitFor(() => expect(localStorage.getItem(GUEST_PROGRESS_KEY)).not.toBeNull());
    expect(prefsSync.save).not.toHaveBeenCalled();
    expect(prefsSync.migrate).not.toHaveBeenCalled();
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('/api/progress'))).toBe(false);
  });

  it('saves the place in the guest store on this device', async () => {
    const data = await dataFor('v-rain');
    const { engine } = mount(data);
    await waitFor(() => expect(engine.loads).toHaveLength(1));
    const video = document.querySelector('video')!;
    Object.defineProperty(video, 'currentTime', { value: 42, configurable: true, writable: true });
    Object.defineProperty(video, 'duration', { value: 300, configurable: true });
    video.dispatchEvent(new Event('pause'));
    await waitFor(() => expect(readGuestProgress(localStorage, data.video.id)).not.toBeNull());
    expect(readGuestProgress(localStorage, data.video.id)).toMatchObject({
      p: 42,
      d: 300,
      f: false,
    });
  });

  it('resumes at the saved place minus 3 seconds (M40-S04 AC2) from the guest store', async () => {
    const data = await dataFor('v-rain');
    localStorage.setItem(
      GUEST_PROGRESS_KEY,
      JSON.stringify({ v: 1, items: { [data.video.id]: { p: 20, d: 300, f: false, t: 1 } } }),
    );
    const { engine } = mount(data);
    await waitFor(() => expect(engine.loads).toHaveLength(1));
    expect(engine.loads[0]?.startPosition).toBe(17);
  });

  it('keeps a changed caption style on this device under the guest key (L4-07)', async () => {
    const data = await dataFor('v-rain');
    const en = data.captions[0]!;
    const { engine } = mount({
      ...data,
      captions: [en, { ...en, id: 'yo', language: 'yo', label: 'Yoruba', status: 'approved' }],
    });
    await waitFor(() => expect(engine.loads).toHaveLength(1));
    fireEvent.click(screen.getByRole('button', { name: 'Captions, off' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Caption appearance' }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Edge, Outline' }));
    expect(JSON.parse(localStorage.getItem(captionStyleKey('guest')) ?? '{}')).toMatchObject({
      edge: 'outline',
    });
  });

  it('plays from 0 when the stored data is corrupt', async () => {
    localStorage.setItem(GUEST_PROGRESS_KEY, '{oops');
    const { engine } = mount(await dataFor('v-rain'));
    await waitFor(() => expect(engine.loads).toHaveLength(1));
    expect(engine.loads[0]?.startPosition ?? 0).toBe(0);
  });

  it('keeps playing and says once that the place is not saved when storage is blocked', async () => {
    const data = await dataFor('v-rain');
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    const { engine } = mount(data);
    await waitFor(() => expect(engine.loads).toHaveLength(1));
    const video = document.querySelector('video')!;
    Object.defineProperty(video, 'currentTime', { value: 42, configurable: true, writable: true });
    Object.defineProperty(video, 'duration', { value: 300, configurable: true });
    video.dispatchEvent(new Event('pause'));
    await waitFor(() =>
      expect(screen.getByText('Your place is not being saved on this device.')).toBeTruthy(),
    );
    video.dispatchEvent(new Event('pause'));
    expect(screen.getAllByText('Your place is not being saved on this device.')).toHaveLength(1);
  });
});
