import { Forbidden, NotFound, Unauthorized } from '@ad/shared';
import { describe, expect, it } from 'vitest';
import { createPlaybackHandlers } from './http';

const VID = 'vid';
function setup() {
  const calls: unknown[][] = [];
  const service = {
    startSession: async (...a: unknown[]) => (calls.push(['session', ...a]), { token: 't' }),
    startPreview: async (...a: unknown[]) => (calls.push(['preview', ...a]), { token: 'p' }),
    master: async (...a: unknown[]) => (calls.push(['master', ...a]), '#EXTM3U\n'),
    variant: async (...a: unknown[]) => (calls.push(['variant', ...a]), '#EXTM3U\n'),
    key: async (...a: unknown[]) => (calls.push(['key', ...a]), new Uint8Array(16).fill(1)),
  };
  const handlers = createPlaybackHandlers({
    service: service as never,
    getViewer: async (r) => {
      if (!r.headers.get('cookie')) throw new Unauthorized();
      return { accountId: 'a', profileId: 'p' };
    },
    getActor: async () => ({ accountId: 'a', role: 'editor' }),
    assertSameOrigin: (r) => {
      if (r.headers.get('origin') === 'https://evil.example') throw new Forbidden('Cross site request');
    },
    clientIp: () => '9.9.9.9',
  });
  return { handlers, calls };
}

describe('playback handlers', () => {
  it('mints a session for a signed in viewer', async () => {
    const { handlers, calls } = setup();
    const res = await handlers.session(
      new Request('https://app/x', { method: 'POST', headers: { cookie: 'c' }, body: '{}' }),
      VID,
    );
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(calls[0]).toEqual(['session', { accountId: 'a', profileId: 'p' }, VID]);
  });

  it('requires a signed in viewer and a same origin request', async () => {
    const { handlers } = setup();
    const anon = await handlers.session(new Request('https://app/x', { method: 'POST' }), VID);
    expect(anon.status).toBe(401);
    const evil = await handlers.session(
      new Request('https://app/x', { method: 'POST', headers: { origin: 'https://evil.example', cookie: 'c' } }),
      VID,
    );
    expect(evil.status).toBe(403);
  });

  it('routes preview requests through the staff actor', async () => {
    const { handlers, calls } = setup();
    const res = await handlers.session(
      new Request('https://app/x', { method: 'POST', body: JSON.stringify({ preview: true }) }),
      VID,
    );
    expect(res.status).toBe(200);
    expect(calls[0]?.[0]).toBe('preview');
  });

  it('reads the bearer token and serves playlists without caching', async () => {
    const { handlers, calls } = setup();
    const res = await handlers.master(new Request('https://app/m', { headers: { authorization: 'Bearer abc' } }), VID);
    expect(res.headers.get('content-type')).toBe('application/vnd.apple.mpegurl');
    expect(res.headers.get('cache-control')).toBe('private, no-store');
    expect(res.headers.get('referrer-policy')).toBe('no-referrer');
    expect(calls[0]).toEqual(['master', 'abc', VID, false]);
  });

  it('falls back to the pt query parameter and flags it', async () => {
    const { handlers, calls } = setup();
    await handlers.variant(new Request('https://app/v?pt=tok'), VID, '720');
    expect(calls[0]).toEqual(['variant', 'tok', VID, '720', true]);
  });

  it('returns the key as raw bytes with the client ip', async () => {
    const { handlers, calls } = setup();
    const res = await handlers.key(new Request('https://app/k?pt=tok'), VID);
    expect(res.headers.get('content-type')).toBe('application/octet-stream');
    expect(new Uint8Array(await res.arrayBuffer())).toHaveLength(16);
    expect(calls[0]).toEqual(['key', 'tok', VID, '9.9.9.9']);
  });

  it('maps service errors to statuses', async () => {
    const handlers = createPlaybackHandlers({
      service: { master: async () => { throw new NotFound(); } } as never,
      getViewer: async () => ({ accountId: 'a', profileId: 'p' }),
      getActor: async () => ({ accountId: 'a', role: 'admin' }),
      clientIp: () => 'x',
    });
    expect((await handlers.master(new Request('https://app/m?pt=t'), VID)).status).toBe(404);
  });
});
