import { FieldErrors } from '@ad/auth';
import { RateLimited } from '@ad/shared';
import { describe, expect, it, vi } from 'vitest';
import { RealAccountRepository } from './account-repo';
import type { GatewayIo } from './gateway';

const actor = { accountId: 'a1', role: 'viewer' as const, sessionId: 's1' };

function setup(mfa: Record<string, unknown>) {
  const io = {
    meta: async () => ({ ip: null, ipTrunc: null, userAgent: null, requestId: null }),
    currentActor: async () => actor,
  } as unknown as GatewayIo;
  return new RealAccountRepository(
    {} as never,
    {} as never,
    io,
    () => new Date(),
    undefined,
    mfa as never,
  );
}

describe('RealAccountRepository two step', () => {
  it('reads the state', async () => {
    const repo = setup({
      status: async () => ({ enabled: true, recoveryRemaining: 2, low: true }),
    });
    expect(await repo.twoFactor('a1')).toEqual({ enabled: true, recoveryRemaining: 2, low: true });
  });

  it('begins and returns the key, link and picture', async () => {
    const repo = setup({
      beginEnrolment: async () => ({ secret: 'S', uri: 'U', qrSvg: '<svg/>' }),
    });
    expect(await repo.beginTwoFactor('a1')).toEqual({
      ok: true,
      secret: 'S',
      uri: 'U',
      qrSvg: '<svg/>',
    });
  });

  it('confirms and hands back the codes once', async () => {
    const confirmEnrolment = vi.fn(async () => ({ recoveryCodes: ['a-b'] }));
    const repo = setup({ confirmEnrolment });
    expect(await repo.confirmTwoFactor('a1', { code: '123456' })).toEqual({
      ok: true,
      recoveryCodes: ['a-b'],
    });
  });

  it('maps wrong and locked codes', async () => {
    const wrong = setup({
      confirmEnrolment: async () => {
        throw new FieldErrors({ code: 'x' });
      },
    });
    expect(await wrong.confirmTwoFactor('a1', { code: '1' })).toEqual({
      ok: false,
      reason: 'wrong',
    });
    const locked = setup({
      confirmEnrolment: async () => {
        throw new RateLimited(900);
      },
    });
    expect(await locked.confirmTwoFactor('a1', { code: '1' })).toEqual({
      ok: false,
      reason: 'locked',
      minutes: 15,
    });
  });

  it('tells a wrong password from a wrong code when turning off', async () => {
    const pw = setup({
      disable: async () => {
        throw new FieldErrors({ password: 'x' });
      },
    });
    expect(await pw.disableTwoFactor('a1', { password: 'p', code: 'c' })).toEqual({
      ok: false,
      reason: 'wrong_password',
    });
    const code = setup({
      disable: async () => {
        throw new FieldErrors({ code: 'x' });
      },
    });
    expect(await code.disableTwoFactor('a1', { password: 'p', code: 'c' })).toEqual({
      ok: false,
      reason: 'wrong_code',
    });
    const ok = setup({ disable: async () => undefined });
    expect(await ok.disableTwoFactor('a1', { password: 'p', code: 'c' })).toEqual({ ok: true });
  });

  it('regenerates with the password', async () => {
    const repo = setup({ regenerateRecoveryCodes: async () => ['x-y'] });
    expect(await repo.regenerateRecoveryCodes('a1', { password: 'p' })).toEqual({
      ok: true,
      recoveryCodes: ['x-y'],
    });
    const bad = setup({
      regenerateRecoveryCodes: async () => {
        throw new FieldErrors({ password: 'x' });
      },
    });
    expect(await bad.regenerateRecoveryCodes('a1', { password: 'p' })).toEqual({
      ok: false,
      reason: 'wrong_password',
    });
  });
});
