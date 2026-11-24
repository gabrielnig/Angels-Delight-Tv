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
      if (r.headers.get('origin') === 'https://evil.example')
        throw new Forbidden('Cross site request');
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
    expect(calls[0]).toEqual([
      'session',
      { accountId: 'a', profileId: 'p', activeProfileId: 'p' },
      VID,
    ]);
  });

  it('uses the profile named in the body', async () => {
    const { handlers, calls } = setup();
    await handlers.session(
      new Request('https://app/x', {
        method: 'POST',
        headers: { cookie: 'c' },
        body: '{"profileId":"p2"}',
      }),
      VID,
    );
    expect(calls[0]).toEqual([
      'session',
      { accountId: 'a', profileId: 'p2', activeProfileId: 'p' },
      VID,
    ]);
  });

  it('requires a signed in viewer and a same origin request', async () => {
    const { handlers } = setup();
    const anon = await handlers.session(new Request('https://app/x', { method: 'POST' }), VID);
    expect(anon.status).toBe(401);
    const evil = await handlers.session(
      new Request('https://app/x', {
        method: 'POST',
        headers: { origin: 'https://evil.example', cookie: 'c' },
      }),
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
    const res = await handlers.master(
      new Request('https://app/m', { headers: { authorization: 'Bearer abc' } }),
      VID,
    );
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
      service: {
        master: async () => {
          throw new NotFound();
        },
      } as never,
      getViewer: async () => ({ accountId: 'a', profileId: 'p' }),
      getActor: async () => ({ accountId: 'a', role: 'admin' }),
      clientIp: () => 'x',
    });
    expect((await handlers.master(new Request('https://app/m?pt=t'), VID)).status).toBe(404);
  });

  describe('denied requests leave an audit light log line (M31-S02 AC2)', () => {
    function denying(error: Error) {
      const denied: Array<Record<string, unknown>> = [];
      const handlers = createPlaybackHandlers({
        service: {
          key: async () => {
            throw error;
          },
        } as never,
        getViewer: async () => ({ accountId: 'a', profileId: 'p' }),
        getActor: async () => ({ accountId: 'a', role: 'admin' }),
        clientIp: () => '9.9.9.9',
        onDenied: (info) => denied.push({ ...info }),
      });
      return { handlers, denied };
    }

    it('logs a refused key request with route, status and video but never the token', async () => {
      const { handlers, denied } = denying(new Forbidden('Token is for another video'));
      const res = await handlers.key(new Request('https://app/k?pt=secret-token-value'), VID);
      expect(res.status).toBe(403);
      expect(denied).toEqual([{ route: 'key', status: 403, videoId: VID, ip: '9.9.9.9' }]);
      expect(JSON.stringify(denied)).not.toContain('secret-token-value');
    });

    it('logs a missing token as a 401', async () => {
      const { handlers, denied } = denying(new Unauthorized('Playback token required'));
      await handlers.key(new Request('https://app/k'), VID);
      expect(denied[0]).toMatchObject({ route: 'key', status: 401 });
    });

    it('does not log a missing video, which is not a denial', async () => {
      const { handlers, denied } = denying(new NotFound());
      await handlers.key(new Request('https://app/k?pt=t'), VID);
      expect(denied).toEqual([]);
    });

    it('never lets a failing log hook change the answer', async () => {
      const handlers = createPlaybackHandlers({
        service: {
          key: async () => {
            throw new Forbidden();
          },
        } as never,
        getViewer: async () => ({ accountId: 'a', profileId: 'p' }),
        getActor: async () => ({ accountId: 'a', role: 'admin' }),
        clientIp: () => 'x',
        onDenied: () => {
          throw new Error('log down');
        },
      });
      expect((await handlers.key(new Request('https://app/k?pt=t'), VID)).status).toBe(403);
    });
  });

  describe('guest sessions (M40-S02, M40-S03)', () => {
    function guestSetup(
      over: {
        play?: boolean;
        guest?: { guestId: string; kids: boolean; setCookie?: string } | null;
      } = {},
    ) {
      const calls: unknown[][] = [];
      const mints: boolean[] = [];
      const service = {
        startSession: async (...a: unknown[]) => (calls.push(['session', ...a]), { token: 't' }),
        startGuestSession: async (...a: unknown[]) => (calls.push(['guest', ...a]), { token: 'g' }),
      };
      const handlers = createPlaybackHandlers({
        service: service as never,
        getViewer: async (r) => {
          if (!r.headers.get('cookie')?.includes('acct')) throw new Unauthorized();
          return { accountId: 'a', profileId: 'p' };
        },
        getActor: async (r) => {
          if (!r.headers.get('cookie')?.includes('acct')) throw new Unauthorized();
          return { accountId: 'a', role: 'editor' };
        },
        assertSameOrigin: (r) => {
          if (r.headers.get('origin') === 'https://evil.example')
            throw new Forbidden('Cross site request');
        },
        clientIp: () => '9.9.9.9',
        guestPlayEnabled: async () => over.play ?? true,
        getGuest: async (_r, o) => {
          mints.push(o.mint);
          return over.guest === undefined ? { guestId: 'gid', kids: false } : over.guest;
        },
      });
      return { handlers, calls, mints };
    }
    const post = (headers: Record<string, string> = {}) =>
      new Request('https://app/x', { method: 'POST', headers, body: '{}' });

    it('mints a guest session when there is no account and sets the cookie once', async () => {
      const { handlers, calls, mints } = guestSetup({
        guest: { guestId: 'gid', kids: false, setCookie: '__Host-ad_guest=v; Path=/' },
      });
      const res = await handlers.session(post(), VID);
      expect(res.status).toBe(200);
      expect(res.headers.getSetCookie()).toEqual(['__Host-ad_guest=v; Path=/']);
      expect(mints).toEqual([true]);
      expect(calls[0]).toEqual(['guest', { guestId: 'gid', kids: false, ip: '9.9.9.9' }, VID]);
    });

    it('sets no cookie when the guest cookie already verified', async () => {
      const { handlers } = guestSetup();
      const res = await handlers.session(post(), VID);
      expect(res.status).toBe(200);
      expect(res.headers.getSetCookie()).toEqual([]);
    });

    it('lets a valid account session win over a guest cookie', async () => {
      const { handlers, calls } = guestSetup();
      const res = await handlers.session(post({ cookie: 'acct' }), VID);
      expect(res.status).toBe(200);
      expect(calls[0]?.[0]).toBe('session');
      expect(res.headers.getSetCookie()).toEqual([]);
    });

    it('answers 401 and mints nothing when guest play is off', async () => {
      const { handlers, calls, mints } = guestSetup({ play: false });
      const res = await handlers.session(post(), VID);
      expect(res.status).toBe(401);
      expect(calls).toEqual([]);
      expect(mints).toEqual([]);
    });

    it('refuses a cross origin guest POST before any cookie is read or set', async () => {
      const { handlers, calls, mints } = guestSetup();
      const res = await handlers.session(post({ origin: 'https://evil.example' }), VID);
      expect(res.status).toBe(403);
      expect(calls).toEqual([]);
      expect(mints).toEqual([]);
    });

    it('never gives a guest a preview', async () => {
      const { handlers, calls } = guestSetup();
      const res = await handlers.session(
        new Request('https://app/x', { method: 'POST', body: '{"preview":true}' }),
        VID,
      );
      expect(res.status).toBe(401);
      expect(calls).toEqual([]);
    });

    it('ignores a profile id sent by a guest', async () => {
      const { handlers, calls } = guestSetup();
      await handlers.session(
        new Request('https://app/x', { method: 'POST', body: '{"profileId":"p9"}' }),
        VID,
      );
      expect(JSON.stringify(calls[0])).not.toContain('p9');
    });
  });
});
