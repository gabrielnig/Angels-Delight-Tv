import { describe, expect, it, vi } from 'vitest';
import { getTransport } from './playback.server';

const REAL = { DATABASE_URL: 'postgres://x', FIELD_KEK: 'k', EMAIL_HASH_PEPPER: 'p' };

describe('getTransport', () => {
  it('always uses the real routes in production', () => {
    expect(getTransport({ NODE_ENV: 'production', PLAYBACK_TRANSPORT: 'fixture' })).toBe('http');
  });

  it('follows real viewer data outside production, so a real title never gets a sample stream', () => {
    expect(getTransport({ NODE_ENV: 'development', ...REAL })).toBe('http');
    expect(getTransport({ NODE_ENV: 'development', ...REAL, VIEWER_FIXTURES: 'on' })).toBe(
      'fixture',
    );
    expect(getTransport({ NODE_ENV: 'development' })).toBe('fixture');
  });

  it('lets PLAYBACK_TRANSPORT decide outside production when it is set', () => {
    expect(getTransport({ NODE_ENV: 'development', PLAYBACK_TRANSPORT: 'http' })).toBe('http');
    expect(getTransport({ NODE_ENV: 'development', ...REAL, PLAYBACK_TRANSPORT: 'fixture' })).toBe(
      'fixture',
    );
  });
});

describe('getViewerContext guests (M40-S02)', () => {
  const NEXT = '/watch/abc';

  async function load(options: {
    session: unknown;
    guestPlay: boolean;
    profileId?: string | null;
  }) {
    vi.resetModules();
    vi.doMock('server-only', () => ({}));
    const redirect = vi.fn((to: string) => {
      throw new Error(`redirect:${to}`);
    });
    vi.doMock('next/navigation', () => ({ redirect }));
    vi.doMock('../../server/data/mode', () => ({ realDataEnabled: () => true }));
    vi.doMock('../../server/auth/session', () => ({ getSession: async () => options.session }));
    vi.doMock('../../server/guest/guest-settings', () => ({
      guestPlayEnabled: async () => options.guestPlay,
    }));
    vi.doMock('../../server/data/profile-io', () => ({
      cookieProfileIo: () => ({ activeProfileId: async () => options.profileId ?? null }),
    }));
    vi.doMock('../../server/data/real-data', () => ({ accountViewerData: () => ({}) }));
    vi.doMock('../../server/data/real-playback', () => ({ RealPlaybackData: class {} }));
    vi.doMock('../../server/viewer/runtime', () => ({ viewerRuntime: () => ({}) }));
    vi.doMock('../../server/data/actor', () => ({ viewerActor: () => ({}) }));
    vi.doMock('./playback.fixture', () => ({ createFixturePlaybackData: () => ({}) }));
    vi.doMock('@ad/video', () => ({ DrizzlePlaybackStore: class {} }));
    vi.doMock('@ad/viewer', () => ({ loadOwnedProfile: async () => ({}) }));
    vi.doMock('@ad/db', () => ({ withAccount: async () => ({}) }));
    const mod = await import('./playback.server');
    return { getViewerContext: mod.getViewerContext, redirect };
  }
  const cookies = { get: () => undefined };

  it('gives a signed out visitor a guest context and no redirect when guest play is on', async () => {
    const { getViewerContext, redirect } = await load({ session: null, guestPlay: true });
    await expect(getViewerContext(cookies, NEXT)).resolves.toEqual({
      profileId: 'none',
      kids: false,
      guest: true,
    });
    expect(redirect).not.toHaveBeenCalled();
  });

  it('keeps the sign in redirect, with next, when guest play is off', async () => {
    const { getViewerContext } = await load({ session: null, guestPlay: false });
    await expect(getViewerContext(cookies, NEXT)).rejects.toThrow(
      `redirect:/sign-in?next=${encodeURIComponent(NEXT)}`,
    );
  });

  it('gives a guest context to a metadata lookup too (no next)', async () => {
    const { getViewerContext } = await load({ session: null, guestPlay: true });
    await expect(getViewerContext(cookies)).resolves.toMatchObject({ guest: true });
  });

  it('leaves a signed in viewer untouched: an unverified account is still sent to verify', async () => {
    const { getViewerContext } = await load({
      session: { status: 'active', emailVerified: false, accountId: 'a' },
      guestPlay: true,
    });
    await expect(getViewerContext(cookies, NEXT)).rejects.toThrow('redirect:/verify-email');
  });

  it('leaves a signed in viewer without a profile on the picker', async () => {
    const { getViewerContext } = await load({
      session: { status: 'active', emailVerified: true, accountId: 'a' },
      guestPlay: true,
      profileId: null,
    });
    await expect(getViewerContext(cookies, NEXT)).rejects.toThrow('redirect:/profiles');
  });
});
