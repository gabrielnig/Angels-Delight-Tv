import { describe, expect, it, vi } from 'vitest';
import {
  createHlsEngine,
  createNativeEngine,
  createPlayerEngine,
  mapHlsError,
  type HlsEventData,
  type HlsInstanceLike,
  type HlsLevelLike,
  type HlsStatic,
} from './hlsEngine';
import type { EngineEvent } from './engine';

const APP = 'https://app.example.test';
const ERROR_TYPES = { NETWORK_ERROR: 'networkError', MEDIA_ERROR: 'mediaError' };

class FakeHls implements HlsInstanceLike {
  static instances: FakeHls[] = [];
  static supported = true;
  static Events = { MANIFEST_PARSED: 'parsed', LEVEL_SWITCHED: 'switched', ERROR: 'error' };
  static ErrorTypes = ERROR_TYPES;
  static DefaultConfig = {
    loader: class {
      load() {}
    },
  };
  static isSupported() {
    return FakeHls.supported;
  }
  levels: HlsLevelLike[] = [
    { height: 240, bitrate: 300_000 },
    { height: 360, bitrate: 600_000 },
    { height: 480, bitrate: 900_000 },
    { height: 720, bitrate: 1_800_000 },
  ];
  bandwidthEstimate = 0;
  currentLevel = 2;
  // keeps `levels` assignable with details in tests
  loadLevel = 2;
  nextLevel = -1;
  nextAutoLevel = -1;
  autoLevelCapping = -1;
  startLevel = -1;
  handlers = new Map<string, (e: string, d: HlsEventData) => void>();
  started: number[] = [];
  source = '';
  destroyed = false;
  mediaRecoveries = 0;
  constructor(public config: Record<string, unknown>) {
    FakeHls.instances.push(this);
  }
  on(event: string, l: (e: string, d: HlsEventData) => void) {
    this.handlers.set(event, l);
  }
  loadSource(url: string) {
    this.source = url;
  }
  attachMedia() {}
  startLoad(p?: number) {
    this.started.push(p ?? -1);
  }
  recoverMediaError() {
    this.mediaRecoveries += 1;
  }
  destroy() {
    this.destroyed = true;
  }
  fire(event: string, data: HlsEventData = {}) {
    this.handlers.get(event)?.(event, data);
  }
}

const Hls = FakeHls as unknown as HlsStatic;
const video = () => document.createElement('video');
const last = () => FakeHls.instances[FakeHls.instances.length - 1] as FakeHls;

function engine() {
  FakeHls.instances = [];
  const e = createHlsEngine({ Hls, video: video(), appOrigin: APP, getToken: () => 'T' });
  const events: EngineEvent[] = [];
  e.on((ev) => events.push(ev));
  e.load({ src: `${APP}/api/play/v1/master.m3u8`, startPosition: 30, lowData: false, cap: null });
  return { e, events, hls: last() };
}

describe('mapHlsError', () => {
  const t = ERROR_TYPES;
  it('maps statuses', () => {
    expect(
      mapHlsError({ type: t.NETWORK_ERROR, details: 'keyLoadError', response: { code: 401 } }, t),
    ).toMatchObject({ kind: 'auth', fatal: true, status: 401 });
    expect(
      mapHlsError({ type: t.NETWORK_ERROR, details: 'fragLoadError', response: { code: 403 } }, t),
    ).toMatchObject({ kind: 'forbidden', fatal: true });
    expect(
      mapHlsError(
        { type: t.NETWORK_ERROR, details: 'manifestLoadError', response: { code: 404 } },
        t,
      ),
    ).toMatchObject({ kind: 'gone' });
  });
  it('keeps fatal flags for network and media errors', () => {
    expect(
      mapHlsError({ type: t.NETWORK_ERROR, details: 'fragLoadError', fatal: false }, t),
    ).toMatchObject({ kind: 'network', fatal: false });
    expect(
      mapHlsError({ type: t.NETWORK_ERROR, details: 'fragLoadError', fatal: true }, t),
    ).toMatchObject({ kind: 'network', fatal: true });
    expect(
      mapHlsError({ type: t.MEDIA_ERROR, details: 'bufferAppendError', fatal: true }, t),
    ).toMatchObject({ kind: 'media', fatal: true });
  });
  it('reads the status from networkDetails when there is no response', () => {
    expect(mapHlsError({ type: t.NETWORK_ERROR, networkDetails: { status: 401 } }, t).kind).toBe(
      'auth',
    );
  });
});

describe('createHlsEngine with a fake hls.js', () => {
  it('loads the source and starts loading at the position once levels are known', () => {
    const { hls } = engine();
    expect(hls.source).toContain('/api/play/v1/master.m3u8');
    expect(hls.started).toEqual([]);
    hls.fire('parsed');
    expect(hls.started).toEqual([30]);
  });

  it('starts on 480p normally and on 360p on low data', () => {
    const a = engine();
    a.hls.fire('parsed');
    expect(a.hls.startLevel).toBe(2);
    FakeHls.instances = [];
    const e = createHlsEngine({ Hls, video: video(), appOrigin: APP, getToken: () => 'T' });
    e.load({ src: 'x', startPosition: 0, lowData: true, cap: null });
    last().fire('parsed');
    expect(last().startLevel).toBe(1);
  });

  it('reports a silent video when every rendition declares video only codecs', () => {
    const { events, hls } = engine();
    hls.levels = hls.levels.map((l) => ({ ...l, videoCodec: 'avc1.42c01e' }));
    hls.fire('parsed');
    expect(events).toContainEqual({ type: 'levels', heights: [240, 360, 480, 720], audio: false });
  });

  it('reports sound when a rendition declares an audio codec', () => {
    const { events, hls } = engine();
    hls.levels = hls.levels.map((l) => ({
      ...l,
      videoCodec: 'avc1.42c01e',
      audioCodec: 'mp4a.40.2',
    }));
    hls.fire('parsed');
    expect(events).toContainEqual({ type: 'levels', heights: [240, 360, 480, 720], audio: true });
  });

  it('finds the start of the segment that holds a time from the loaded playlist', () => {
    const { e, hls } = engine();
    hls.levels[2] = {
      ...hls.levels[2]!,
      details: {
        fragments: [
          { start: 0, duration: 6 },
          { start: 6, duration: 6 },
        ],
      },
    };
    expect(e.segmentStart?.(7.5)).toBe(6);
    expect(e.segmentStart?.(99)).toBeNull();
  });

  it('reports the bandwidth estimate on level switches and on destroy, and seeds the first estimate', () => {
    FakeHls.instances = [];
    const seen: number[] = [];
    const e = createHlsEngine({
      Hls,
      video: video(),
      appOrigin: APP,
      getToken: () => 'T',
      initialBandwidth: 1_100_000,
      onBandwidth: (bps) => seen.push(bps),
    });
    e.load({ src: `${APP}/m.m3u8`, startPosition: 0, lowData: false, cap: null });
    const hls = last();
    expect(hls.config.abrEwmaDefaultEstimate).toBe(1_100_000);
    hls.bandwidthEstimate = 2_000_000;
    hls.fire('switched', { level: 1 });
    hls.bandwidthEstimate = 2_400_000;
    e.destroy();
    expect(seen).toEqual([2_000_000, 2_400_000]);
  });

  it('reports the ladder and level switches', () => {
    const { events, hls } = engine();
    hls.fire('parsed');
    hls.fire('switched', { level: 3 });
    expect(events).toContainEqual({ type: 'levels', heights: [240, 360, 480, 720] });
    expect(events).toContainEqual({ type: 'level', height: 720, bitrate: 1_800_000 });
  });

  it('applies the data saver cap at load and on change', () => {
    FakeHls.instances = [];
    const e = createHlsEngine({ Hls, video: video(), appOrigin: APP, getToken: () => 'T' });
    e.load({ src: 'x', startPosition: 0, lowData: true, cap: 360 });
    const h = last();
    h.fire('parsed');
    expect(h.autoLevelCapping).toBe(1);
    e.setQuality('auto', null);
    expect(h.autoLevelCapping).toBe(-1);
  });

  it('locks a manual rung and returns to auto', () => {
    const { e, hls } = engine();
    hls.fire('parsed');
    e.setQuality(720, null);
    expect(hls.nextLevel).toBe(3);
    e.setQuality('auto', null);
    expect(hls.nextLevel).toBe(-1);
  });

  it('drops one rung on request and reports when it cannot', () => {
    const { e, hls } = engine();
    hls.fire('parsed');
    expect(e.dropQuality()).toBe(true);
    expect(hls.nextAutoLevel).toBe(1);
    hls.loadLevel = 0;
    expect(e.dropQuality()).toBe(false);
  });

  it('maps hls errors to engine errors', () => {
    const { events, hls } = engine();
    hls.fire('error', {
      type: ERROR_TYPES.NETWORK_ERROR,
      details: 'keyLoadError',
      response: { code: 401 },
      fatal: true,
    });
    expect(events.at(-1)).toMatchObject({ type: 'error', error: { kind: 'auth', status: 401 } });
  });

  it('recovers by restarting the load from the playhead and recovers media errors', () => {
    const { e, hls } = engine();
    e.recover();
    expect(hls.started.at(-1)).toBe(0);
    e.recoverMedia();
    expect(hls.mediaRecoveries).toBe(1);
  });

  it('reload destroys the old instance and starts a new one at the position', () => {
    const { e, hls } = engine();
    e.reload(77);
    expect(hls.destroyed).toBe(true);
    const next = last();
    expect(next).not.toBe(hls);
    next.fire('parsed');
    expect(next.started).toEqual([77]);
  });

  it('configures auth from the latest token', () => {
    const { e, hls } = engine();
    e.setToken('NEW');
    const xhr = { setRequestHeader: vi.fn() } as unknown as XMLHttpRequest;
    (hls.config as { xhrSetup: (x: XMLHttpRequest, u: string) => void }).xhrSetup(
      xhr,
      `${APP}/api/hls/keys/v1`,
    );
    expect(xhr.setRequestHeader).toHaveBeenCalledWith('Authorization', 'Bearer NEW');
  });
});

describe('createNativeEngine', () => {
  it('uses a ?pt= token on playlist routes', () => {
    const v = video();
    v.load = vi.fn();
    const e = createNativeEngine({ video: v, appOrigin: APP, getToken: () => 'T' });
    e.load({ src: `${APP}/api/play/v1/master.m3u8`, startPosition: 0, lowData: false, cap: null });
    expect(v.getAttribute('src')).toBe(`${APP}/api/play/v1/master.m3u8?pt=T`);
    expect(e.dropQuality()).toBe(false);
  });
});

describe('createPlayerEngine', () => {
  const base = { appOrigin: APP, getToken: () => 'T' };
  it('prefers hls.js when MSE is available', async () => {
    const e = await createPlayerEngine({ ...base, video: video(), loadHls: async () => Hls });
    expect(e.name).toBe('hls.js');
  });
  it('falls back to native HLS', async () => {
    FakeHls.supported = false;
    const v = video();
    v.canPlayType = () => 'maybe';
    const e = await createPlayerEngine({ ...base, video: v, loadHls: async () => Hls });
    expect(e.name).toBe('native');
    FakeHls.supported = true;
  });
  it('reports unsupported when nothing can play', async () => {
    FakeHls.supported = false;
    const e = await createPlayerEngine({ ...base, video: video(), loadHls: async () => Hls });
    expect(e.name).toBe('unsupported');
    const seen: EngineEvent[] = [];
    e.on((ev) => seen.push(ev));
    e.load({ src: 'x', startPosition: 0, lowData: false, cap: null });
    await Promise.resolve();
    expect(seen[0]).toMatchObject({ type: 'error', error: { kind: 'unsupported' } });
    FakeHls.supported = true;
  });
});
