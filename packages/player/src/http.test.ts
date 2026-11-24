import { describe, expect, it, vi } from 'vitest';
import { createHttpProgressSink, createHttpSessionProvider } from './http';
import { ProgressSinkError } from './progress';
import { SessionError } from './token';

function res(status: number, body?: unknown): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('createHttpSessionProvider', () => {
  it('posts to the session route with credentials and maps the response', async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      res(200, {
        token: 'v1.k.p.m',
        expiresAt: '2026-11-17T10:30:00Z',
        masterUrl: '/api/play/v1/master.m3u8',
      }),
    );
    const provider = createHttpSessionProvider({
      appOrigin: 'https://app.test',
      profileId: 'p1',
      fetchFn,
    });
    const s = await provider.createSession('v1');
    expect(fetchFn).toHaveBeenCalledWith(
      'https://app.test/api/play/v1/session',
      expect.objectContaining({ method: 'POST', credentials: 'include' }),
    );
    expect(s).toEqual({
      token: 'v1.k.p.m',
      expiresAt: Date.parse('2026-11-17T10:30:00Z'),
      masterUrl: 'https://app.test/api/play/v1/master.m3u8',
    });
  });

  it('omits profileId from the body when there is none (guest, M40-S02)', async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValue(
        res(200, { token: 't', expiresAt: 1_800_000_000, masterUrl: '/api/play/v1/master.m3u8' }),
      );
    const provider = createHttpSessionProvider({ appOrigin: 'https://app.test', fetchFn });
    await provider.createSession('v1');
    const init = fetchFn.mock.calls[0]![1] as RequestInit;
    expect(JSON.parse(init.body as string)).toEqual({});
    expect(init.credentials).toBe('include');
  });

  it('accepts a numeric expiry in milliseconds or seconds', async () => {
    const mk = (n: number) =>
      createHttpSessionProvider({
        appOrigin: 'https://app.test',
        profileId: 'p1',
        fetchFn: vi
          .fn()
          .mockResolvedValue(
            res(200, { token: 't', expiresAt: n, masterUrl: 'https://x.test/m.m3u8' }),
          ),
      }).createSession('v1');
    expect((await mk(1_800_000_000)).expiresAt).toBe(1_800_000_000_000);
    expect((await mk(1_800_000_000_000)).expiresAt).toBe(1_800_000_000_000);
  });

  it.each([
    [401, 'auth'],
    [403, 'gone'],
    [404, 'gone'],
    [410, 'gone'],
    [429, 'rate-limited'],
    [500, 'network'],
  ])('maps status %i to %s', async (status, kind) => {
    const provider = createHttpSessionProvider({
      appOrigin: 'https://app.test',
      profileId: 'p1',
      fetchFn: vi.fn().mockResolvedValue(res(status)),
    });
    await expect(provider.createSession('v1')).rejects.toMatchObject({ kind });
  });

  it('maps a thrown fetch to a network error', async () => {
    const provider = createHttpSessionProvider({
      appOrigin: 'https://app.test',
      profileId: 'p1',
      fetchFn: vi.fn().mockRejectedValue(new TypeError('failed')),
    });
    await expect(provider.createSession('v1')).rejects.toBeInstanceOf(SessionError);
  });

  it('rejects a malformed body as a network error', async () => {
    const provider = createHttpSessionProvider({
      appOrigin: 'https://app.test',
      profileId: 'p1',
      fetchFn: vi.fn().mockResolvedValue(res(200, { nope: true })),
    });
    await expect(provider.createSession('v1')).rejects.toMatchObject({ kind: 'network' });
  });
});

describe('createHttpSessionProvider challenge (M40-S11)', () => {
  const ok = () =>
    res(200, { token: 'v1.k.p.m', expiresAt: '2026-11-17T10:30:00Z', masterUrl: '/m.m3u8' });
  const asked = () => res(403, { error: { code: 'challenge_required', message: 'x' } });

  it('throws a challenge error when asked and there is no way to answer', async () => {
    const fetchFn = vi.fn().mockResolvedValue(asked());
    const provider = createHttpSessionProvider({ appOrigin: 'https://app.test', fetchFn });
    await expect(provider.createSession('v1')).rejects.toMatchObject({ kind: 'challenge' });
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('gets a token from the host and tries once more with it in the header', async () => {
    const fetchFn = vi.fn().mockResolvedValueOnce(asked()).mockResolvedValueOnce(ok());
    const solveChallenge = vi.fn().mockResolvedValue('tok');
    const provider = createHttpSessionProvider({
      appOrigin: 'https://app.test',
      fetchFn,
      solveChallenge,
    });
    await expect(provider.createSession('v1')).resolves.toMatchObject({ token: 'v1.k.p.m' });
    expect(fetchFn).toHaveBeenCalledTimes(2);
    const retry = fetchFn.mock.calls[1]![1] as RequestInit;
    expect((retry.headers as Record<string, string>)['x-turnstile-token']).toBe('tok');
  });

  it('gives up with a challenge error when the visitor does not pass it', async () => {
    const fetchFn = vi.fn().mockResolvedValue(asked());
    const provider = createHttpSessionProvider({
      appOrigin: 'https://app.test',
      fetchFn,
      solveChallenge: async () => null,
    });
    await expect(provider.createSession('v1')).rejects.toMatchObject({ kind: 'challenge' });
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('asks only once per attempt, so a wrong token cannot loop', async () => {
    const fetchFn = vi.fn().mockResolvedValue(asked());
    const solveChallenge = vi.fn().mockResolvedValue('tok');
    const provider = createHttpSessionProvider({
      appOrigin: 'https://app.test',
      fetchFn,
      solveChallenge,
    });
    await expect(provider.createSession('v1')).rejects.toMatchObject({ kind: 'challenge' });
    expect(solveChallenge).toHaveBeenCalledTimes(1);
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it('keeps a plain 403 as gone', async () => {
    const fetchFn = vi.fn().mockResolvedValue(res(403, { error: { code: 'forbidden' } }));
    const provider = createHttpSessionProvider({ appOrigin: 'https://app.test', fetchFn });
    await expect(provider.createSession('v1')).rejects.toMatchObject({ kind: 'gone' });
  });
});

describe('createHttpProgressSink', () => {
  const update = {
    videoId: 'v1',
    profileId: 'p1',
    positionSeconds: 12,
    durationSeconds: 300,
    ended: false,
  };

  it('posts JSON with keepalive', async () => {
    const fetchFn = vi.fn().mockResolvedValue(res(204));
    const sink = createHttpProgressSink({ endpoint: '/api/watch/progress', fetchFn });
    await sink.save(update);
    expect(fetchFn).toHaveBeenCalledWith(
      '/api/watch/progress',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        keepalive: true,
        body: JSON.stringify(update),
      }),
    );
  });

  it('uses sendBeacon when asked and available', async () => {
    const sendBeacon = vi.fn().mockReturnValue(true);
    const fetchFn = vi.fn();
    const sink = createHttpProgressSink({ endpoint: '/api/watch/progress', fetchFn, sendBeacon });
    await sink.save(update, { beacon: true });
    expect(sendBeacon).toHaveBeenCalledWith('/api/watch/progress', expect.any(Blob));
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('falls back to keepalive fetch when the beacon is refused', async () => {
    const fetchFn = vi.fn().mockResolvedValue(res(204));
    const sink = createHttpProgressSink({ endpoint: '/x', fetchFn, sendBeacon: () => false });
    await sink.save(update, { beacon: true });
    expect(fetchFn).toHaveBeenCalled();
  });

  it('throws a ProgressSinkError with the status', async () => {
    const sink = createHttpProgressSink({
      endpoint: '/x',
      fetchFn: vi.fn().mockResolvedValue(res(401)),
    });
    await expect(sink.save(update)).rejects.toMatchObject({
      name: 'ProgressSinkError',
      status: 401,
    });
  });

  it('reports a network failure as status 0', async () => {
    const sink = createHttpProgressSink({
      endpoint: '/x',
      fetchFn: vi.fn().mockRejectedValue(new TypeError('x')),
    });
    const err = await sink.save(update).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ProgressSinkError);
    expect((err as ProgressSinkError).status).toBe(0);
  });
});

describe('createHttpProgressSink body mapping', () => {
  const update = {
    videoId: 'v1',
    profileId: 'p1',
    positionSeconds: 12.5,
    durationSeconds: 60,
    ended: false,
  };

  it('sends the update as is by default', async () => {
    const fetchFn = vi.fn().mockResolvedValue(res(200, {}));
    await createHttpProgressSink({ endpoint: '/api/progress', fetchFn }).save(update);
    expect(JSON.parse(fetchFn.mock.calls[0]![1].body)).toEqual(update);
  });

  it('sends the mapped body for fetch and for sendBeacon', async () => {
    const fetchFn = vi.fn().mockResolvedValue(res(200, {}));
    const sendBeacon = vi.fn().mockReturnValue(true);
    const sink = createHttpProgressSink({
      endpoint: '/api/progress',
      fetchFn,
      sendBeacon,
      toBody: (u) => ({ id: u.videoId, ms: Math.round(u.positionSeconds * 1000) }),
    });
    await sink.save(update);
    expect(JSON.parse(fetchFn.mock.calls[0]![1].body)).toEqual({ id: 'v1', ms: 12500 });
    await sink.save(update, { beacon: true });
    const blob = sendBeacon.mock.calls[0]![1] as Blob;
    expect(JSON.parse(await blob.text())).toEqual({ id: 'v1', ms: 12500 });
  });
});
