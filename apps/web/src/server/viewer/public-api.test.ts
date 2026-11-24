import { RateLimited, type Actor } from '@ad/shared';
import { describe, expect, it, vi } from 'vitest';
import { createPublicGuard, type PublicGuardDeps } from './public-api';

const actor: Actor = { accountId: 'a1', role: 'viewer' };

function setup(over: Partial<PublicGuardDeps> = {}) {
  const spent: string[] = [];
  const deps: PublicGuardDeps = {
    resolveActor: async () => null,
    guestId: () => null,
    audience: async () => ({ kids: false }),
    clientIp: () => '203.0.113.7',
    spend: async (bucket, subject) => void spent.push(`${bucket}:${subject}`),
    ...over,
  };
  const personal = vi.fn(async () => Response.json({ who: 'account' }));
  const guest = vi.fn(
    async (_req: Request, _params: Record<string, string>, audience: { kids: boolean }) =>
      Response.json({ who: 'guest', kids: audience.kids }),
  );
  const handler = createPublicGuard(deps)(personal, guest);
  const searchHandler = createPublicGuard(deps)(personal, guest, { search: true });
  return { handler, searchHandler, personal, guest, spent };
}
const get = (url = 'https://app.test/api/home') => new Request(url);

describe('public guard (M40-S01, D-G11)', () => {
  it('runs the personal handler unchanged when a session exists', async () => {
    const { handler, personal, guest } = setup({ resolveActor: async () => actor });
    const res = await handler(get(), { id: 'x' });
    expect(await res.json()).toEqual({ who: 'account' });
    expect(personal).toHaveBeenCalledWith(expect.any(Request), { id: 'x' });
    expect(guest).not.toHaveBeenCalled();
  });

  it('runs the guest handler with the audience when there is no session', async () => {
    const { handler, personal, guest } = setup({ audience: async () => ({ kids: true }) });
    const res = await handler(get(), {});
    expect(await res.json()).toEqual({ who: 'guest', kids: true });
    expect(personal).not.toHaveBeenCalled();
    expect(guest).toHaveBeenCalledOnce();
  });

  it('answers 405 for anything but GET and HEAD, before any lookup', async () => {
    const { handler, personal, guest, spent } = setup();
    for (const method of ['POST', 'PUT', 'DELETE', 'PATCH']) {
      const res = await handler(new Request('https://app.test/api/home', { method }));
      expect(res.status).toBe(405);
      expect(res.headers.get('allow')).toBe('GET, HEAD');
    }
    expect(personal).not.toHaveBeenCalled();
    expect(guest).not.toHaveBeenCalled();
    expect(spent).toEqual([]);
  });

  it('limits a guest by address and, when the cookie verifies, by guest id', async () => {
    const withId = setup({ guestId: () => 'gid' });
    await withId.handler(get(), {});
    expect(withId.spent).toEqual(['api:guest-ip:203.0.113.7', 'api:guest:gid']);
    const without = setup();
    await without.handler(get(), {});
    expect(without.spent).toEqual(['api:guest-ip:203.0.113.7']);
  });

  it('adds the search bucket for search routes', async () => {
    const { searchHandler, spent } = setup({ guestId: () => 'gid' });
    await searchHandler(get('https://app.test/api/search?q=rain'), {});
    expect(spent).toEqual([
      'api:guest-ip:203.0.113.7',
      'api:guest:gid',
      'search:guest-ip:203.0.113.7',
      'search:guest:gid',
    ]);
  });

  it('spends nothing for a signed in request: the account limiter in the personal handler applies', async () => {
    const { handler, spent } = setup({ resolveActor: async () => actor });
    await handler(get(), {});
    expect(spent).toEqual([]);
  });

  it('answers 429 with Retry-After when a limit is hit, and never calls the guest handler', async () => {
    const { handler, guest } = setup({
      spend: async () => {
        throw new RateLimited(17);
      },
    });
    const res = await handler(get(), {});
    expect(res.status).toBe(429);
    expect(res.headers.get('retry-after')).toBe('17');
    expect(guest).not.toHaveBeenCalled();
  });

  it('passes unexpected errors on for the request wrapper to log, never as a body', async () => {
    const { handler } = setup({
      audience: async () => {
        throw new Error('db down');
      },
    });
    await expect(handler(get(), {})).rejects.toThrow('db down');
  });

  it('a limiter that fails does not become a guest bypass: the error is passed on', async () => {
    const { handler, guest } = setup({
      spend: async () => {
        throw new Error('limiter store down');
      },
    });
    await expect(handler(get(), {})).rejects.toThrow('limiter store down');
    expect(guest).not.toHaveBeenCalled();
  });
});
