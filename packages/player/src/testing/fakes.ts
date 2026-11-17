import type {
  EngineEvent,
  EngineLoadOptions,
  NetworkMonitor,
  PageEvents,
  PlayerEngine,
  PlayerMedia,
} from '../engine';
import type { QualitySelection } from '../quality';

/** A scriptable stand in for HTMLVideoElement. Call emit() to simulate media events. */
export class FakeMedia extends EventTarget implements PlayerMedia {
  private time = 0;
  /** When false, play() only emits "play" and a test emits "playing" itself. */
  autoStart = true;
  duration = Number.NaN;
  paused = true;
  ended = false;
  volume = 1;
  muted = false;
  playbackRate = 1;
  error: { code: number } | null = null;
  bufferedRanges: Array<[number, number]> = [];
  playCalls = 0;
  playRejects = false;

  get currentTime(): number {
    return this.time;
  }

  /** Setting the time clears the ended flag, as seeking does in a browser. */
  set currentTime(value: number) {
    this.time = value;
    this.ended = false;
  }

  get buffered() {
    const r = this.bufferedRanges;
    return { length: r.length, start: (i: number) => r[i]?.[0] ?? 0, end: (i: number) => r[i]?.[1] ?? 0 };
  }

  play(): Promise<void> {
    this.playCalls += 1;
    if (this.playRejects) return Promise.reject(new DOMException('blocked', 'NotAllowedError'));
    this.paused = false;
    this.emit('play');
    if (this.autoStart) this.emit('playing');
    return Promise.resolve();
  }

  pause(): void {
    if (this.paused) return;
    this.paused = true;
    this.emit('pause');
  }

  emit(type: string): void {
    this.dispatchEvent(new Event(type));
  }

  /** Simulate metadata arriving. */
  setDuration(d: number): void {
    this.duration = d;
    this.emit('durationchange');
    this.emit('loadedmetadata');
  }

  /** Simulate natural playback advancing. */
  advance(to: number): void {
    this.time = to;
    this.emit('timeupdate');
  }

  finish(): void {
    this.currentTime = this.duration;
    this.ended = true;
    this.paused = true;
    this.emit('pause');
    this.emit('ended');
  }
}

export class FakeEngine implements PlayerEngine {
  readonly name = 'fake';
  loads: EngineLoadOptions[] = [];
  reloads: number[] = [];
  recovers = 0;
  mediaRecovers = 0;
  tokens: Array<string | null> = [];
  qualityCalls: Array<{ selection: QualitySelection; cap: number | null }> = [];
  dropCalls = 0;
  canDrop = true;
  destroyed = false;
  private listeners = new Set<(e: EngineEvent) => void>();

  load(opts: EngineLoadOptions): void {
    this.loads.push(opts);
  }
  reload(startPosition: number): void {
    this.reloads.push(startPosition);
  }
  recover(): void {
    this.recovers += 1;
  }
  recoverMedia(): void {
    this.mediaRecovers += 1;
  }
  setQuality(selection: QualitySelection, cap: number | null): void {
    this.qualityCalls.push({ selection, cap });
  }
  dropQuality(): boolean {
    this.dropCalls += 1;
    return this.canDrop;
  }
  setToken(token: string | null): void {
    this.tokens.push(token);
  }
  on(listener: (e: EngineEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  destroy(): void {
    this.destroyed = true;
    this.listeners.clear();
  }
  emit(event: EngineEvent): void {
    for (const l of this.listeners) l(event);
  }
}

export class FakeNetwork implements NetworkMonitor {
  online = true;
  private listeners = new Set<(online: boolean) => void>();
  isOnline(): boolean {
    return this.online;
  }
  subscribe(listener: (online: boolean) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  set(online: boolean): void {
    this.online = online;
    for (const l of this.listeners) l(online);
  }
}

export class FakePage implements PageEvents {
  private vis = new Set<(hidden: boolean) => void>();
  private hide = new Set<() => void>();
  onVisibility(listener: (hidden: boolean) => void): () => void {
    this.vis.add(listener);
    return () => this.vis.delete(listener);
  }
  onPageHide(listener: () => void): () => void {
    this.hide.add(listener);
    return () => this.hide.delete(listener);
  }
  setHidden(hidden: boolean): void {
    for (const l of this.vis) l(hidden);
  }
  pagehide(): void {
    for (const l of this.hide) l();
  }
}
