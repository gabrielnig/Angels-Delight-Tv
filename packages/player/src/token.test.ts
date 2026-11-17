import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createKeyAwareLoader,
  resolveKeyUrl,
  SessionError,
  shouldAttachAuth,
  TokenManager,
  withNativeToken,
  type PlaybackSession,
  type SessionProvider,
} from './token';

const APP = 'https://app.example.test';

function session(n: number, ttlMs = 30 * 60_000, now = Date.now()): PlaybackSession {
  return { token: `tok-${n}`, expiresAt: now + ttlMs, masterUrl: `${APP}/api/play/v1/master.m3u8` };
}

describe('TokenManager', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-17T10:00:00Z'));
  });
  afterEach(() => vi.useRealTimers());

  function make(
    provider: SessionProvider,
    extra: Partial<ConstructorParameters<typeof TokenManager>[0]> = {},
  ) {
    return new TokenManager({ videoId: 'v1', provider, initial: session(1), ...extra });
  }

  it('exposes the initial token', () => {
    const tm = make({ createSession: vi.fn() });
    expect(tm.token).toBe('tok-1');
    expect(tm.masterUrl).toContain('/api/play/v1/master.m3u8');
    tm.dispose();
  });

  it('silently refreshes before expiry and notifies subscribers', async () => {
    const createSession = vi.fn().mockImplementation(async () => session(2));
    const tm = make({ createSession });
    const seen: string[] = [];
    tm.subscribe((s) => seen.push(s.token));
    await vi.advanceTimersByTimeAsync(27 * 60_000);
    expect(createSession).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(3 * 60_000);
    expect(createSession).toHaveBeenCalledTimes(1);
    expect(tm.token).toBe('tok-2');
    expect(seen).toEqual(['tok-2']);
    tm.dispose();
  });

  it('shares one in flight refresh between callers', async () => {
    let resolve!: (s: PlaybackSession) => void;
    const createSession = vi
      .fn()
      .mockReturnValue(new Promise<PlaybackSession>((r) => (resolve = r)));
    const tm = make({ createSession });
    const a = tm.refresh();
    const b = tm.refresh();
    resolve(session(2));
    await expect(a).resolves.toMatchObject({ token: 'tok-2' });
    await expect(b).resolves.toMatchObject({ token: 'tok-2' });
    expect(createSession).toHaveBeenCalledTimes(1);
    tm.dispose();
  });

  it('reports a refused refresh to onFailure and stops retrying', async () => {
    const createSession = vi.fn().mockRejectedValue(new SessionError('gone'));
    const onFailure = vi.fn();
    const tm = make({ createSession }, { onFailure });
    await vi.advanceTimersByTimeAsync(29 * 60_000);
    expect(onFailure).toHaveBeenCalledTimes(1);
    expect(onFailure.mock.calls[0]?.[0]).toMatchObject({ kind: 'gone' });
    await vi.advanceTimersByTimeAsync(5 * 60_000);
    expect(createSession).toHaveBeenCalledTimes(1);
    tm.dispose();
  });

  it('retries a scheduled refresh on network failure, then succeeds', async () => {
    const createSession = vi
      .fn()
      .mockRejectedValueOnce(new SessionError('network'))
      .mockImplementation(async () => session(3));
    const onFailure = vi.fn();
    const tm = make({ createSession }, { onFailure, retryDelayMs: 5_000 });
    await vi.advanceTimersByTimeAsync(28 * 60_000 + 6_000);
    expect(createSession).toHaveBeenCalledTimes(2);
    expect(tm.token).toBe('tok-3');
    expect(onFailure).not.toHaveBeenCalled();
    tm.dispose();
  });

  it('rejects an explicit refresh with the session error kind', async () => {
    const tm = make({ createSession: vi.fn().mockRejectedValue(new SessionError('auth')) });
    await expect(tm.refresh()).rejects.toMatchObject({ kind: 'auth' });
    tm.dispose();
  });

  it('mints a first session when no initial one is given', async () => {
    const createSession = vi.fn().mockImplementation(async () => session(9));
    const tm = new TokenManager({ videoId: 'v1', provider: { createSession } });
    expect(tm.token).toBeNull();
    await tm.refresh();
    expect(tm.token).toBe('tok-9');
    tm.dispose();
  });

  it('stops the timer on dispose', async () => {
    const createSession = vi.fn();
    const tm = make({ createSession });
    tm.dispose();
    await vi.advanceTimersByTimeAsync(40 * 60_000);
    expect(createSession).not.toHaveBeenCalled();
  });
});

describe('shouldAttachAuth', () => {
  it('attaches only for the app origin', () => {
    expect(shouldAttachAuth(`${APP}/api/hls/keys/v1`, APP)).toBe(true);
    expect(shouldAttachAuth('https://media.example.test/v/a/360/seg_1.ts?exp=1&sig=x', APP)).toBe(
      false,
    );
    expect(shouldAttachAuth('http://[bad', APP)).toBe(false);
  });
});

describe('resolveKeyUrl', () => {
  it('rewrites ad-key URIs to the key route', () => {
    expect(resolveKeyUrl('ad-key://v1', APP)).toBe(`${APP}/api/hls/keys/v1`);
  });
  it('leaves other URLs alone', () => {
    expect(resolveKeyUrl('https://x.test/a.ts', APP)).toBe('https://x.test/a.ts');
  });
  it('encodes the video id', () => {
    expect(resolveKeyUrl('ad-key://a b', APP)).toBe(`${APP}/api/hls/keys/a%20b`);
  });
});

describe('withNativeToken', () => {
  it('adds pt on playlist and key routes of the app origin only', () => {
    expect(withNativeToken(`${APP}/api/play/v1/master.m3u8`, 'T', APP)).toBe(
      `${APP}/api/play/v1/master.m3u8?pt=T`,
    );
    expect(withNativeToken(`${APP}/api/hls/keys/v1`, 'T', APP)).toBe(`${APP}/api/hls/keys/v1?pt=T`);
    expect(withNativeToken(`${APP}/api/other`, 'T', APP)).toBe(`${APP}/api/other`);
    expect(withNativeToken('https://media.example.test/seg.ts', 'T', APP)).toBe(
      'https://media.example.test/seg.ts',
    );
  });
});

describe('createKeyAwareLoader', () => {
  it('rewrites ad-key context urls before delegating', () => {
    const seen: string[] = [];
    class Base {
      load(context: { url: string }) {
        seen.push(context.url);
      }
    }
    const Loader = createKeyAwareLoader(Base, APP);
    new Loader().load({ url: 'ad-key://v1' });
    new Loader().load({ url: 'https://media.example.test/seg.ts' });
    expect(seen).toEqual([`${APP}/api/hls/keys/v1`, 'https://media.example.test/seg.ts']);
  });
});
