// @vitest-environment jsdom
import { FakeEngine, FakeNetwork } from '@ad/player/testing';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createFixturePlaybackData } from '@/lib/data/playback.fixture';
import type { WatchData } from '@/lib/data/playback';
import { preferencesKey } from './preferences';
import { WatchClient } from './WatchClient';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

const viewer = { profileId: 'p1', kids: false };

async function dataFor(id: string): Promise<WatchData> {
  const r = await createFixturePlaybackData().getWatchData(id, viewer);
  if (r.status !== 'ok') throw new Error('fixture missing');
  return r.data;
}

function mount(
  data: WatchData,
  extra: {
    startAt?: number | null;
    network?: FakeNetwork;
    prefsSync?: NonNullable<Parameters<typeof WatchClient>[0]['prefsSync']>;
  } = {},
) {
  const engine = new FakeEngine();
  const network = extra.network ?? new FakeNetwork();
  const utils = render(
    <WatchClient
      data={data}
      viewer={viewer}
      transport="fixture"
      startAt={extra.startAt ?? null}
      prefsSync={extra.prefsSync}
      testing={{ createEngine: async () => engine, network }}
    >
      <h1>{data.video.title}</h1>
    </WatchClient>,
  );
  return { engine, network, ...utils };
}

describe('WatchClient', () => {
  beforeEach(() => {
    localStorage.clear();
    push.mockClear();
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => undefined);
    vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => undefined);
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('mints a fixture session and loads the sample stream at the resume position', async () => {
    const { engine } = mount(await dataFor('v-rain'));
    await waitFor(() => expect(engine.loads).toHaveLength(1));
    expect(engine.loads[0]).toMatchObject({
      src: `${window.location.origin}/fixtures/hls/plain/master.m3u8`,
      startPosition: 11,
    });
    expect(engine.tokens).toContain('fixture-token');
    expect(screen.getByRole('region', { name: 'Video player: How Rain Is Made' })).toBeTruthy();
    expect(screen.getByText('Resumed from 0:14')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Start over' })).toBeTruthy();
  });

  it('lets ?t override the saved position without a resume toast', async () => {
    const { engine } = mount(await dataFor('v-rain'), { startAt: 10 });
    await waitFor(() => expect(engine.loads).toHaveLength(1));
    expect(engine.loads[0]?.startPosition).toBe(10);
    expect(screen.queryByText(/Resumed from/)).toBeNull();
  });

  it('prefers the newest local progress in fixture mode', async () => {
    localStorage.setItem(
      'ad.progress.p1.v-plants',
      JSON.stringify({ positionSeconds: 20, finished: false }),
    );
    const { engine } = mount(await dataFor('v-plants'));
    await waitFor(() => expect(engine.loads).toHaveLength(1));
    expect(engine.loads[0]?.startPosition).toBe(17);
  });

  it('passes markers and chapters to the player', async () => {
    const data = await dataFor('v-rain');
    expect(data.markers?.intro).toEqual({ start: 5, end: 20 });
    expect(data.chapters).toHaveLength(2);
    const { engine } = mount(data);
    await waitFor(() => expect(engine.loads).toHaveLength(1));
    expect(screen.getByRole('button', { name: 'Chapters' })).toBeTruthy();
  });

  it('renders a Skip intro button when resume lands inside the intro', async () => {
    const { engine } = mount(await dataFor('v-rain'));
    await waitFor(() => expect(engine.loads).toHaveLength(1));
    expect(screen.getByRole('button', { name: /Skip intro/ })).toBeTruthy();
  });

  it('shows no Skip button for a video with no markers', async () => {
    const { engine } = mount(await dataFor('v-plants'));
    await waitFor(() => expect(engine.loads).toHaveLength(1));
    expect(screen.queryByRole('button', { name: /^Skip/ })).toBeNull();
  });

  it('attaches only the approved caption track', async () => {
    const { container, engine } = mount(await dataFor('v-rain'));
    await waitFor(() => expect(engine.loads).toHaveLength(1));
    expect([...container.querySelectorAll('track')].map((t) => t.id)).toEqual(['en']);
  });

  it('hides the CC button for a title without captions', async () => {
    const { engine } = mount(await dataFor('v-magnets'));
    await waitFor(() => expect(engine.loads).toHaveLength(1));
    expect(screen.queryByRole('button', { name: /^Captions/ })).toBeNull();
  });

  it('uses the AES-128 sample for the encrypted fixture', async () => {
    const { engine } = mount(await dataFor('v-encrypted'));
    await waitFor(() => expect(engine.loads).toHaveLength(1));
    expect(engine.loads[0]?.src).toContain('/fixtures/hls/enc/master.m3u8');
  });

  it('stores player preferences per profile', async () => {
    const { engine } = mount(await dataFor('v-plants'));
    await waitFor(() => expect(engine.loads).toHaveLength(1));
    fireEvent.click(screen.getByRole('button', { name: 'Mute' }));
    expect(JSON.parse(localStorage.getItem(preferencesKey('p1')) ?? '{}')).toMatchObject({
      muted: true,
    });
  });

  describe('server side preferences (M03-S09)', () => {
    const settings = {
      autoplayNext: true,
      dataSaver: false,
      quality: 'auto' as const,
      speed: 1,
      captionsDefault: false,
      captionSize: 'medium' as const,
      captionLanguage: 'en',
    };

    it('starts at the speed the profile has on the server, not the one on this device', async () => {
      localStorage.setItem(preferencesKey('p1'), JSON.stringify({ volume: 0.5 }));
      const data = await dataFor('v-plants');
      data.preferences = { ...data.preferences, rate: 1.5 };
      const { engine } = mount(data);
      await waitFor(() => expect(engine.loads).toHaveLength(1));
      expect(document.querySelector('video')?.playbackRate).toBe(1.5);
    });

    it('moves choices an older version kept on the device to the server before playing, then clears them', async () => {
      localStorage.setItem(
        preferencesKey('p1'),
        JSON.stringify({ rate: 1.25, dataSaver: true, volume: 0.4 }),
      );
      const migrate = vi.fn(async () => ({ ...settings, speed: 1.25, dataSaver: true }));
      const { engine } = mount(await dataFor('v-plants'), {
        prefsSync: { save: vi.fn(async () => undefined), migrate },
      });
      await waitFor(() => expect(engine.loads).toHaveLength(1));
      expect(migrate).toHaveBeenCalledWith('p1', { speed: 1.25, dataSaver: true });
      expect(document.querySelector('video')?.playbackRate).toBe(1.25);
      expect(JSON.parse(localStorage.getItem(preferencesKey('p1')) ?? '{}')).toEqual({
        volume: 0.4,
      });
    });

    it('still plays when the move fails, and keeps the device values for next time', async () => {
      localStorage.setItem(preferencesKey('p1'), JSON.stringify({ rate: 1.25 }));
      const { engine } = mount(await dataFor('v-plants'), {
        prefsSync: {
          save: vi.fn(async () => undefined),
          migrate: vi.fn(async () => {
            throw new Error('offline');
          }),
        },
      });
      await waitFor(() => expect(engine.loads).toHaveLength(1));
      expect(JSON.parse(localStorage.getItem(preferencesKey('p1')) ?? '{}')).toMatchObject({
        rate: 1.25,
      });
    });

    it('sends a speed change to the server and keeps volume on the device', async () => {
      const save = vi.fn(async () => undefined);
      const { engine } = mount(await dataFor('v-plants'), {
        prefsSync: { save, migrate: vi.fn(async () => settings) },
      });
      await waitFor(() => expect(engine.loads).toHaveLength(1));
      const region = screen.getByRole('region', { name: /Video player/ });
      act(() => region.focus());
      fireEvent.keyDown(region, { key: '>', shiftKey: true });
      await waitFor(() => expect(save).toHaveBeenCalledWith('p1', { speed: 1.25 }));
      expect(JSON.parse(localStorage.getItem(preferencesKey('p1')) ?? '{}')).not.toHaveProperty(
        'rate',
      );
    });
  });

  it('goes to the next title with the N shortcut', async () => {
    const { engine } = mount(await dataFor('v-sky'));
    await waitFor(() => expect(engine.loads).toHaveLength(1));
    const region = screen.getByRole('region', { name: /Video player/ });
    act(() => region.focus());
    fireEvent.keyDown(region, { key: 'n' });
    expect(push).toHaveBeenCalledWith('/watch/v-sun');
  });

  it('shows the Offline screen with Back when opened offline, then the player when online again', async () => {
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    const { engine } = mount(await dataFor('v-plants'));
    expect(await screen.findByText('You are offline')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Back' }).getAttribute('href')).toBe('/');
    expect(screen.getByRole('heading', { name: 'How Plants Make Their Own Food' })).toBeTruthy();
    expect(engine.loads).toHaveLength(0);
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
    act(() => window.dispatchEvent(new Event('online')));
    await waitFor(() => expect(engine.loads).toHaveLength(1));
  });

  it('shares or copies the link and toggles My List with feedback', async () => {
    const { engine } = mount(await dataFor('v-plants'));
    await waitFor(() => expect(engine.loads).toHaveLength(1));
    const add = screen.getByRole('button', { name: '+ My List' });
    fireEvent.click(add);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'In My List' }).getAttribute('aria-pressed')).toBe(
        'true',
      ),
    );
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', {
      ...navigator,
      share: undefined,
      clipboard: { writeText },
      onLine: true,
    });
    fireEvent.click(screen.getByRole('button', { name: 'Share' }));
    await waitFor(() => expect(screen.getByText('Link copied')).toBeTruthy());
  });
});
