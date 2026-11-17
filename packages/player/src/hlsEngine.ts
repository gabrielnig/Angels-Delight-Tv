import type { EngineError, EngineEvent, EngineLoadOptions, PlayerEngine } from './engine';
import { createHlsConfig } from './hlsConfig';
import { pickStartHeight, type QualitySelection } from './quality';
import { withNativeToken } from './token';

/** The slice of hls.js this engine touches. Declared here so tests can supply a fake. */
export interface HlsLevelLike {
  height: number;
  bitrate: number;
}

export interface HlsInstanceLike {
  levels: HlsLevelLike[];
  currentLevel: number;
  loadLevel: number;
  nextLevel: number;
  nextAutoLevel: number;
  autoLevelCapping: number;
  startLevel: number;
  on(event: string, listener: (event: string, data: HlsEventData) => void): void;
  loadSource(url: string): void;
  attachMedia(media: HTMLVideoElement): void;
  startLoad(startPosition?: number): void;
  recoverMediaError(): void;
  destroy(): void;
}

export interface HlsEventData {
  type?: string;
  details?: string;
  fatal?: boolean;
  level?: number;
  response?: { code?: number };
  networkDetails?: { status?: number } | null;
}

export interface HlsStatic {
  new (config: object): HlsInstanceLike;
  isSupported(): boolean;
  Events: { MANIFEST_PARSED: string; LEVEL_SWITCHED: string; ERROR: string };
  ErrorTypes: { NETWORK_ERROR: string; MEDIA_ERROR: string };
  DefaultConfig: { loader: new () => { load(context: { url: string }, ...rest: never[]): void } };
}

export function mapHlsError(data: HlsEventData, types: HlsStatic['ErrorTypes']): EngineError {
  const status = data.response?.code ?? data.networkDetails?.status;
  const detail = data.details ?? 'unknown';
  const base = status !== undefined ? { status, detail } : { detail };
  if (status === 401) return { kind: 'auth', fatal: true, ...base };
  if (status === 403) return { kind: 'forbidden', fatal: true, ...base };
  if ((status === 404 || status === 410) && (detail === 'manifestLoadError' || detail === 'levelLoadError')) {
    return { kind: 'gone', fatal: true, ...base };
  }
  if (data.type === types.NETWORK_ERROR) return { kind: 'network', fatal: Boolean(data.fatal), ...base };
  return { kind: 'media', fatal: Boolean(data.fatal), ...base };
}

export interface HlsEngineOptions {
  Hls: HlsStatic;
  video: HTMLVideoElement;
  appOrigin: string;
  getToken: () => string | null;
}

function heightsOf(levels: HlsLevelLike[]): number[] {
  return [...new Set(levels.map((l) => l.height).filter((h) => h > 0))].sort((a, b) => a - b);
}

export function createHlsEngine(opts: HlsEngineOptions): PlayerEngine {
  const { Hls, video } = opts;
  const listeners = new Set<(e: EngineEvent) => void>();
  let hls: HlsInstanceLike | null = null;
  let last: EngineLoadOptions | null = null;
  let token: string | null = null;

  const emit = (e: EngineEvent) => {
    for (const l of [...listeners]) l(e);
  };

  const indexForHeight = (height: number): number =>
    hls?.levels.findIndex((l) => l.height === height) ?? -1;

  const capIndex = (cap: number | null): number => {
    if (cap === null || !hls) return -1;
    let best = -1;
    hls.levels.forEach((l, i) => {
      if (l.height <= cap && (best === -1 || l.height >= (hls?.levels[best]?.height ?? 0))) best = i;
    });
    return best;
  };

  function start(o: EngineLoadOptions): void {
    hls?.destroy();
    last = o;
    const instance = new Hls(
      createHlsConfig({
        appOrigin: opts.appOrigin,
        getToken: () => token ?? opts.getToken(),
        BaseLoader: Hls.DefaultConfig.loader,
      }),
    );
    hls = instance;
    instance.on(Hls.Events.MANIFEST_PARSED, () => {
      const heights = heightsOf(instance.levels);
      emit({ type: 'levels', heights });
      const startHeight = pickStartHeight(heights, { lowData: o.lowData, cap: o.cap });
      if (startHeight !== null) instance.startLevel = indexForHeight(startHeight);
      instance.autoLevelCapping = capIndex(o.cap);
      instance.startLoad(o.startPosition);
    });
    instance.on(Hls.Events.LEVEL_SWITCHED, (_e, data) => {
      const level = instance.levels[data.level ?? -1];
      if (level) emit({ type: 'level', height: level.height, bitrate: level.bitrate });
    });
    instance.on(Hls.Events.ERROR, (_e, data) => emit({ type: 'error', error: mapHlsError(data, Hls.ErrorTypes) }));
    instance.attachMedia(video);
    instance.loadSource(o.src);
  }

  return {
    name: 'hls.js',
    load: start,
    reload(startPosition) {
      if (last) start({ ...last, startPosition });
    },
    recover() {
      hls?.startLoad(video.currentTime);
    },
    recoverMedia() {
      hls?.recoverMediaError();
    },
    setQuality(selection: QualitySelection, cap) {
      if (!hls) return;
      hls.autoLevelCapping = capIndex(cap);
      if (selection === 'auto') {
        hls.nextLevel = -1;
        return;
      }
      const i = indexForHeight(selection);
      if (i >= 0) hls.nextLevel = i;
    },
    dropQuality() {
      if (!hls) return false;
      const current = hls.levels[hls.loadLevel >= 0 ? hls.loadLevel : hls.currentLevel];
      if (!current) return false;
      const lower = hls.levels
        .map((l, i) => ({ h: l.height, i }))
        .filter((x) => x.h > 0 && x.h < current.height)
        .sort((a, b) => b.h - a.h)[0];
      if (!lower) return false;
      if (hls.nextLevel !== -1) hls.nextLevel = -1;
      hls.nextAutoLevel = lower.i;
      return true;
    },
    setToken(next) {
      token = next;
    },
    on(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    destroy() {
      hls?.destroy();
      hls = null;
      listeners.clear();
    },
  };
}

export interface NativeEngineOptions {
  video: HTMLVideoElement;
  appOrigin: string;
  getToken: () => string | null;
}

/** Native HLS (older iOS Safari without MSE). No quality control, token travels as ?pt=. */
export function createNativeEngine(opts: NativeEngineOptions): PlayerEngine {
  const { video } = opts;
  const listeners = new Set<(e: EngineEvent) => void>();
  let token: string | null = null;
  let baseSrc = '';

  const apply = (startPosition: number) => {
    const t = token ?? opts.getToken();
    video.src = t ? withNativeToken(baseSrc, t, opts.appOrigin) : baseSrc;
    if (startPosition > 0) {
      video.addEventListener('loadedmetadata', () => (video.currentTime = startPosition), { once: true });
    }
    video.load();
  };

  return {
    name: 'native',
    load(o) {
      baseSrc = o.src;
      apply(o.startPosition);
    },
    reload: apply,
    recover() {
      video.load();
    },
    recoverMedia() {
      video.load();
    },
    setQuality() {},
    dropQuality: () => false,
    setToken(next) {
      token = next;
    },
    on(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    destroy() {
      video.removeAttribute('src');
      video.load();
      listeners.clear();
    },
  };
}

/** An engine for browsers with neither MSE nor native HLS: reports one fatal unsupported error on load. */
export function createUnsupportedEngine(): PlayerEngine {
  const listeners = new Set<(e: EngineEvent) => void>();
  return {
    name: 'unsupported',
    load() {
      queueMicrotask(() => {
        for (const l of listeners) l({ type: 'error', error: { kind: 'unsupported', fatal: true, detail: 'no MSE or native HLS' } });
      });
    },
    reload() {},
    recover() {},
    recoverMedia() {},
    setQuality() {},
    dropQuality: () => false,
    setToken() {},
    on(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    destroy() {
      listeners.clear();
    },
  };
}

export interface CreateEngineOptions extends NativeEngineOptions {
  /** Loads the hls.js class. Defaults to the pinned build inside @videojs/hlsjs-video. */
  loadHls?: () => Promise<HlsStatic>;
}

/** MSE through hls.js first (headers work), native HLS second, otherwise an unsupported engine. */
export async function createPlayerEngine(opts: CreateEngineOptions): Promise<PlayerEngine> {
  const loadHls =
    opts.loadHls ?? (async () => (await import('@videojs/hlsjs-video')).Hls as unknown as HlsStatic);
  try {
    const Hls = await loadHls();
    if (Hls.isSupported()) return createHlsEngine({ ...opts, Hls });
  } catch {
    // fall through to native
  }
  if (opts.video.canPlayType('application/vnd.apple.mpegurl')) return createNativeEngine(opts);
  return createUnsupportedEngine();
}
