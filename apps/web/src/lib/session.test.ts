import { beforeEach, describe, expect, it, vi } from 'vitest';

const redirect = vi.fn((to: string) => {
  throw new Error(`redirect:${to}`);
});
let session: unknown = null;
let guestKids = false;

vi.mock('next/navigation', () => ({ redirect: (to: string) => redirect(to) }));
vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => undefined }) }));
vi.mock('../server/auth/mode', () => ({ realAuthEnabled: () => true }));
vi.mock('../server/auth/session', () => ({
  getSession: async () => session,
  readSessionToken: async () => undefined,
}));
vi.mock('../server/data/mode', () => ({ realDataEnabled: () => true }));
vi.mock('../server/data/profile-io', () => ({
  cookieProfileIo: () => ({ activeProfileId: async () => null }),
}));
vi.mock('./data', () => ({
  getAccount: () => ({
    overview: async () => ({ email: 'a@b.c', displayName: 'A', memberSince: 'x' }),
  }),
  getProfiles: () => ({
    list: async () => [{ id: 'p1', name: 'One', kids: false }],
  }),
}));
vi.mock('./profiles/always-ask', () => ({
  rememberedProfile: (profiles: unknown[], selected: string | null) =>
    selected ? (profiles[0] ?? null) : null,
}));
vi.mock('./admin/can', () => ({ can: () => false }));
vi.mock('../server/guest/guest-view', () => ({
  currentGuestAudience: async () => (guestKids ? 'kids' : 'adult'),
}));

async function load() {
  const mod = await import('./session');
  return mod.getViewerOrGuest;
}

describe('getViewerOrGuest (M40-S01)', () => {
  beforeEach(() => {
    redirect.mockClear();
    session = null;
    guestKids = false;
    vi.resetModules();
  });

  it('is a guest with the general audience when there is no session, and never redirects', async () => {
    const get = await load();
    const result = await get('/title/x');
    expect(result).toEqual({
      kind: 'guest',
      ctx: { accountId: '', profileId: 'none', audience: 'adult', guest: true },
    });
    expect(redirect).not.toHaveBeenCalled();
  });

  it('carries the Kids mode audience of the device', async () => {
    guestKids = true;
    const get = await load();
    const result = await get();
    expect(result.kind === 'guest' && result.ctx.audience).toBe('kids');
  });

  it('keeps the verify email redirect for an unverified account', async () => {
    session = { accountId: 'a', status: 'active', emailVerified: false, role: 'viewer' };
    const get = await load();
    await expect(get('/title/x')).rejects.toThrow('redirect:/verify-email');
  });

  it('keeps the profile picker redirect for an account with no active profile', async () => {
    session = { accountId: 'a', status: 'active', emailVerified: true, role: 'viewer' };
    const get = await load();
    await expect(get('/title/x')).rejects.toThrow('redirect:/profiles');
  });

  it('sends a pending deletion account to the cancel screen', async () => {
    session = { accountId: 'a', status: 'pending_deletion', emailVerified: true, role: 'viewer' };
    const get = await load();
    await expect(get()).rejects.toThrow('redirect:/account/deletion');
  });
});
