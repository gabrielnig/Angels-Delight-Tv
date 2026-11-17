import { FieldErrors } from '@ad/auth';
import { describe, expect, it, vi } from 'vitest';
import { RealAccountRepository } from './account-repo';
import type { GatewayIo } from './gateway';

const actor = { accountId: 'a1', role: 'viewer' as const, sessionId: 's1' };
const now = new Date('2026-03-10T12:00:00Z');

function setup(
  service: Record<string, unknown> = {},
  sessions: Record<string, unknown> = {},
  viewer?: Record<string, unknown>,
) {
  const io: GatewayIo = {
    meta: async () => ({ ip: null, ipTrunc: null, userAgent: null, requestId: null }),
    setSession: vi.fn(async () => undefined),
    clearSession: vi.fn(async () => undefined),
    readSessionToken: async () => 'tok',
    currentActor: async () => actor,
    setPending: async () => undefined,
    readPending: async () => null,
  };
  const list = vi.fn(async () => [
    {
      id: 's1',
      createdAt: now,
      lastSeenAt: now,
      ipTrunc: '203.0.113.0/24',
      userAgent: 'Mozilla/5.0 (Windows NT 10.0) Chrome/126',
      mfaVerified: false,
    },
    {
      id: 's2',
      createdAt: now,
      lastSeenAt: new Date('2026-03-10T09:00:00Z'),
      ipTrunc: null,
      userAgent: null,
      mfaVerified: false,
    },
  ]);
  const repo = new RealAccountRepository(
    service as never,
    {
      list,
      revokeOwn: vi.fn(async () => true),
      revokeAll: vi.fn(async () => undefined),
      ...sessions,
    } as never,
    io,
    () => now,
    viewer as never,
  );
  return { repo, io, list };
}

describe('RealAccountRepository', () => {
  it('lists devices with a readable label and marks the current one', async () => {
    const devices = await setup().repo.devices('a1');
    expect(devices[0]).toMatchObject({
      id: 's1',
      label: 'Chrome on Windows',
      current: true,
      lastActive: 'Just now',
    });
    expect(devices[1]).toMatchObject({
      id: 's2',
      label: 'Unknown device',
      current: false,
      lastActive: '3 hours ago',
    });
  });

  it('refuses to act for a different account than the signed in one', async () => {
    await expect(setup().repo.devices('someone-else')).rejects.toThrow();
  });

  it('never revokes the current session from the list', async () => {
    const revokeOwn = vi.fn(async () => true);
    const { repo } = setup({}, { revokeOwn });
    await repo.revokeDevice('a1', 's1');
    expect(revokeOwn).not.toHaveBeenCalled();
    await repo.revokeDevice('a1', 's2');
    expect(revokeOwn).toHaveBeenCalledWith('a1', 's2');
  });

  it('revokes every other device and counts them', async () => {
    const revokeAll = vi.fn(async () => undefined);
    const { repo } = setup({}, { revokeAll });
    expect(await repo.revokeOtherDevices('a1')).toBe(1);
    expect(revokeAll).toHaveBeenCalledWith('a1', { exceptSessionId: 's1' });
  });

  it('changes the password, swaps the cookie and reports signed out devices', async () => {
    const changePassword = vi.fn(async (..._a: unknown[]) => ({
      session: { token: 'N', id: 'n' },
    }));
    const { repo, io } = setup({ changePassword });
    expect(await repo.changePassword('a1', { current: 'old', next: 'new' })).toEqual({
      ok: true,
      signedOutDevices: 1,
    });
    expect(changePassword.mock.calls[0]?.[1]).toEqual({
      currentPassword: 'old',
      newPassword: 'new',
    });
    expect(io.setSession).toHaveBeenCalledWith('N', 'viewer');
  });

  it('maps password change problems', async () => {
    const wrong = setup({
      changePassword: async () => {
        throw new FieldErrors({ currentPassword: 'x' });
      },
    });
    expect(await wrong.repo.changePassword('a1', { current: 'o', next: 'n' })).toEqual({
      ok: false,
      reason: 'wrong_current',
    });
    const weak = setup({
      changePassword: async () => {
        throw new FieldErrors({ newPassword: 'x' });
      },
    });
    expect(await weak.repo.changePassword('a1', { current: 'o', next: 'n' })).toEqual({
      ok: false,
      reason: 'weak',
    });
  });

  it('deletes the account and clears the cookie', async () => {
    const deleteAccount = vi.fn(async (..._a: unknown[]) => undefined);
    const { repo, io } = setup({ deleteAccount });
    expect(await repo.deleteAccount('a1', { password: 'p', confirm: 'DELETE' })).toEqual({
      ok: true,
      days: 0,
    });
    expect(deleteAccount.mock.calls[0]?.[1]).toEqual({ password: 'p', confirmation: 'DELETE' });
    expect(io.clearSession).toHaveBeenCalled();
  });

  it('maps delete problems', async () => {
    const pw = setup({
      deleteAccount: async () => {
        throw new FieldErrors({ password: 'x' });
      },
    });
    expect(await pw.repo.deleteAccount('a1', { password: 'p', confirm: 'DELETE' })).toEqual({
      ok: false,
      reason: 'wrong_password',
    });
    const confirm = setup({
      deleteAccount: async () => {
        throw new FieldErrors({ confirmation: 'x' });
      },
    });
    expect(await confirm.repo.deleteAccount('a1', { password: 'p', confirm: 'nope' })).toEqual({
      ok: false,
      reason: 'confirm',
    });
  });

  it('shows the real email and verified state on the overview', async () => {
    const getOverview = async () => ({
      email: 'ada@example.org',
      emailVerified: true,
      memberSince: new Date('2026-03-03T00:00:00Z'),
      profileCount: 2,
      role: 'viewer',
    });
    const overview = await setup({ getOverview }).repo.overview('a1');
    expect(overview).toMatchObject({
      email: 'ada@example.org',
      verified: true,
      displayName: 'Ada',
      devices: 2,
    });
  });
});

describe('RealAccountRepository with viewer data', () => {
  const memberSince = new Date('2026-01-05T08:00:00Z');
  const service = {
    getOverview: vi.fn(async () => ({
      email: 'ada@example.com',
      emailVerified: true,
      memberSince,
    })),
  };
  const viewer = () => ({
    stats: vi.fn(async () => ({ watchedThisMonth: 4, minutesLearning: 37, myListCount: 6 })),
    playback: vi.fn(async () => ({ quality: '720' })),
    savePlayback: vi.fn(async (_a: string, _p: string, patch: object) => ({
      quality: '720',
      ...patch,
    })),
    buildExport: vi.fn(async () => ({ profiles: [], exportedAt: 'x', account: {} })),
    signExportToken: vi.fn(() => 'tok.1.mac'),
  });

  it('fills the overview numbers from the viewer data', async () => {
    const { repo } = setup(service, {}, viewer());
    expect(await repo.overview('a1')).toMatchObject({
      watchedThisMonth: 4,
      minutesLearning: 37,
      myListCount: 6,
      devices: 2,
    });
  });

  it('reads and saves playback settings for the signed in account', async () => {
    const v = viewer();
    const { repo } = setup(service, {}, v);
    expect(await repo.playback('p1')).toEqual({ quality: '720' });
    expect(v.playback).toHaveBeenCalledWith('a1', 'p1');
    await repo.savePlayback('p1', { dataSaver: true });
    expect(v.savePlayback).toHaveBeenCalledWith('a1', 'p1', { dataSaver: true });
  });

  it('starts an export as a short lived download link', async () => {
    const { repo } = setup(service, {}, viewer());
    expect(await repo.exportState('a1')).toEqual({ status: 'none' });
    const state = await repo.requestExport('a1');
    expect(state).toMatchObject({
      status: 'ready',
      fileName: 'angels-delight-data.json',
      downloadHref: '/api/account/export?token=tok.1.mac',
      expiresLabel: 'in 10 minutes',
    });
    expect(state.sizeLabel).toMatch(/KB|bytes/);
  });

  it('says deletion is immediate', async () => {
    const del = vi.fn(async () => undefined);
    const { repo } = setup({ ...service, deleteAccount: del }, {}, viewer());
    expect(await repo.deleteAccount('a1', { password: 'pw', confirm: 'DELETE' })).toEqual({
      ok: true,
      days: 0,
    });
  });
});
