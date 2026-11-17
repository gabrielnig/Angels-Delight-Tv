import { AccountUnavailable, FieldErrors, InvalidCredentials, TokenRejected } from '@ad/auth';
import { RateLimited } from '@ad/shared';
import { describe, expect, it, vi } from 'vitest';
import { RealAuthGateway, type GatewayIo } from './gateway';

function setup(service: Record<string, unknown>, extra: Partial<GatewayIo> = {}) {
  const io: GatewayIo = {
    meta: async () => ({ ip: null, ipTrunc: null, userAgent: null, requestId: null }),
    setSession: vi.fn(async () => undefined),
    clearSession: vi.fn(async () => undefined),
    readSessionToken: vi.fn(async () => 'tok'),
    currentActor: vi.fn(async () => ({
      accountId: 'a1',
      role: 'viewer' as const,
      sessionId: 's1',
    })),
    setPending: vi.fn(async () => undefined),
    readPending: vi.fn(async () => 'me@example.org'),
    ...extra,
  };
  return { gateway: new RealAuthGateway(service as never, io), io };
}

describe('RealAuthGateway.signIn', () => {
  it('sets the session cookie and returns a safe next path', async () => {
    const { gateway, io } = setup({
      signIn: async () => ({
        status: 'signed_in',
        accountId: 'a1',
        role: 'viewer',
        session: { token: 'T', id: 's' },
      }),
    });
    expect(
      await gateway.signIn({ email: 'a@b.co', password: 'x', next: '//evil.example' }),
    ).toEqual({ ok: true, next: '/profiles' });
    expect(io.setSession).toHaveBeenCalledWith('T', 'viewer');
  });

  it('sends unverified accounts to the code screen and remembers the address', async () => {
    const { gateway, io } = setup({
      signIn: async () => ({ status: 'needs_verification', email: 'a@b.co' }),
    });
    expect(await gateway.signIn({ email: 'a@b.co', password: 'x' })).toEqual({
      ok: true,
      next: '/verify-email',
    });
    expect(io.setPending).toHaveBeenCalledWith('a@b.co');
    expect(io.setSession).not.toHaveBeenCalled();
  });

  it('sends staff to the admin login without opening a viewer session (L-6)', async () => {
    const { gateway, io } = setup({
      signIn: async () => ({ status: 'use_admin_login' }) as never,
    });
    expect(await gateway.signIn({ email: 'a@b.co', password: 'x', next: '/browse' })).toEqual({
      ok: true,
      next: '/admin/login',
    });
    expect(io.setSession).not.toHaveBeenCalled();
    expect(io.setPending).not.toHaveBeenCalled();
  });

  it('maps failures without revealing which part was wrong', async () => {
    const bad = setup({
      signIn: async () => {
        throw new InvalidCredentials();
      },
    });
    expect(await bad.gateway.signIn({ email: 'a@b.co', password: 'x' })).toEqual({
      ok: false,
      reason: 'invalid',
    });
    const locked = setup({
      signIn: async () => {
        throw new RateLimited(600);
      },
    });
    expect(await locked.gateway.signIn({ email: 'a@b.co', password: 'x' })).toEqual({
      ok: false,
      reason: 'locked',
      minutes: 10,
    });
    const gone = setup({
      signIn: async () => {
        throw new AccountUnavailable();
      },
    });
    expect(await gone.gateway.signIn({ email: 'a@b.co', password: 'x' })).toEqual({
      ok: false,
      reason: 'unavailable',
    });
    const down = setup({
      signIn: async () => {
        throw new Error('db down');
      },
    });
    expect(await down.gateway.signIn({ email: 'a@b.co', password: 'x' })).toEqual({
      ok: false,
      reason: 'network',
    });
  });
});

describe('RealAuthGateway.signUp', () => {
  it('accepts the notice as consent and moves to verification', async () => {
    const signUp = vi.fn(async (_input: unknown) => ({ email: 'a@b.co', emailSent: true }));
    const { gateway, io } = setup({ signUp });
    expect(await gateway.signUp({ email: 'A@B.co', password: 'river-lantern-42-mango' })).toEqual({
      ok: true,
      next: '/verify-email',
    });
    expect(signUp.mock.calls[0]?.[0]).toMatchObject({
      acceptTerms: true,
      guardianDeclaration: true,
    });
    expect(io.setPending).toHaveBeenCalledWith('a@b.co');
  });

  it('maps field errors to the UI reasons', async () => {
    const weak = setup({
      signUp: async () => {
        throw new FieldErrors({ password: 'too short' });
      },
    });
    expect(await weak.gateway.signUp({ email: 'a@b.co', password: 'x' })).toEqual({
      ok: false,
      reason: 'weak_password',
    });
    const mail = setup({
      signUp: async () => {
        throw new FieldErrors({ email: 'Enter a valid email address' });
      },
    });
    expect(await mail.gateway.signUp({ email: 'nope', password: 'x' })).toEqual({
      ok: false,
      reason: 'invalid_email',
    });
  });
});

describe('RealAuthGateway verification and recovery', () => {
  it('verifies the code for the pending address and signs the person in', async () => {
    const verifyCode = vi.fn(async (_input: unknown) => ({
      status: 'verified',
      accountId: 'a1',
      session: { token: 'T', id: 's' },
    }));
    const { gateway, io } = setup({ verifyCode });
    expect(await gateway.verifyEmail({ code: '123456' })).toEqual({ ok: true, next: '/profiles' });
    expect(verifyCode.mock.calls[0]?.[0]).toEqual({ email: 'me@example.org', code: '123456' });
    expect(io.setSession).toHaveBeenCalledWith('T', 'viewer');
  });

  it('reports wrong, expired and locked codes', async () => {
    expect(
      await setup({ verifyCode: async () => ({ status: 'invalid' }) }).gateway.verifyEmail({
        code: '1',
      }),
    ).toMatchObject({ ok: false, reason: 'wrong' });
    expect(
      await setup({ verifyCode: async () => ({ status: 'expired' }) }).gateway.verifyEmail({
        code: '1',
      }),
    ).toEqual({ ok: false, reason: 'expired' });
    expect(
      await setup({ verifyCode: async () => ({ status: 'too_many' }) }).gateway.verifyEmail({
        code: '1',
      }),
    ).toMatchObject({ ok: false, reason: 'too_many' });
  });

  it('fails the code check when no address is pending', async () => {
    const { gateway } = setup({}, { readPending: async () => null });
    expect(await gateway.verifyEmail({ code: '123456' })).toMatchObject({
      ok: false,
      reason: 'expired',
    });
  });

  it('answers reset requests the same way for any address', async () => {
    const { gateway } = setup({ requestPasswordReset: async () => undefined });
    expect(await gateway.requestPasswordReset({ email: 'x@y.co' })).toEqual({ ok: true });
    const limited = setup({
      requestPasswordReset: async () => {
        throw new RateLimited(60);
      },
    });
    expect(await limited.gateway.requestPasswordReset({ email: 'x@y.co' })).toEqual({
      ok: false,
      reason: 'rate_limited',
    });
  });

  it('maps reset token problems', async () => {
    const expired = setup({
      resetPassword: async () => {
        throw new TokenRejected('expired');
      },
    });
    expect(await expired.gateway.resetPassword({ token: 't', password: 'p' })).toEqual({
      ok: false,
      reason: 'expired',
    });
    const weak = setup({
      resetPassword: async () => {
        throw new FieldErrors({ password: 'weak' });
      },
    });
    expect(await weak.gateway.resetPassword({ token: 't', password: 'p' })).toEqual({
      ok: false,
      reason: 'weak_password',
    });
  });

  it('maps email link outcomes', async () => {
    expect(
      await setup({
        verifyLink: async () => ({ status: 'verified', purpose: 'verify_email' }),
      }).gateway.confirmEmailLink('t'),
    ).toBe('confirmed');
    expect(
      await setup({ verifyLink: async () => ({ status: 'used' }) }).gateway.confirmEmailLink('t'),
    ).toBe('used');
    expect(
      await setup({ verifyLink: async () => ({ status: 'invalid' }) }).gateway.confirmEmailLink(
        't',
      ),
    ).toBe('expired');
  });

  it('signs out by revoking the session and clearing the cookie', async () => {
    const signOut = vi.fn(async (_t: string, _m: unknown) => undefined);
    const { gateway, io } = setup({ signOut });
    await gateway.signOut();
    expect(signOut).toHaveBeenCalledWith('tok', expect.anything());
    expect(io.clearSession).toHaveBeenCalled();
  });
});

describe('RealAuthGateway.checkPassword', () => {
  it('confirms the password for the signed in account', async () => {
    const { gateway } = setup({ reauthenticate: async () => undefined });
    expect(await gateway.checkPassword('p')).toEqual({ ok: true });
  });
  it('reports wrong and locked', async () => {
    const wrong = setup({
      reauthenticate: async () => {
        throw new FieldErrors({ password: 'Password is not right' });
      },
      triesLeft: async () => 3,
    });
    expect(await wrong.gateway.checkPassword('p')).toEqual({
      ok: false,
      reason: 'wrong',
      triesLeft: 3,
    });
    const locked = setup({
      reauthenticate: async () => {
        throw new RateLimited(900);
      },
    });
    expect(await locked.gateway.checkPassword('p')).toEqual({
      ok: false,
      reason: 'locked',
      minutes: 15,
    });
  });
});

describe('RealAuthGateway.pendingEmail', () => {
  it('returns the address waiting for a code, from the signed pending cookie', async () => {
    const { gateway } = setup({});
    expect(await gateway.pendingEmail()).toBe('me@example.org');
  });

  it('is null when nothing is pending', async () => {
    const { gateway } = setup({}, { readPending: async () => null });
    expect(await gateway.pendingEmail()).toBeNull();
  });
});

describe('RealAuthGateway with a Turnstile check', () => {
  const signedIn = {
    signIn: async () => ({
      status: 'signed_in',
      accountId: 'a1',
      role: 'viewer',
      session: { token: 'T', id: 's' },
    }),
    signUp: vi.fn(async () => ({ email: 'a@b.co' })),
  };
  const withCheck = (answer: boolean) => {
    const check = vi.fn(async () => answer);
    const io = setup(signedIn).io;
    return { check, gateway: new RealAuthGateway(signedIn as never, io, check), io };
  };

  it('asks for the check and never calls the service when the token fails', async () => {
    const service = { signIn: vi.fn(), signUp: vi.fn() };
    const io = setup({}).io;
    const gateway = new RealAuthGateway(service as never, io, async () => false);
    expect(await gateway.signIn({ email: 'a@b.co', password: 'x' })).toEqual({
      ok: false,
      reason: 'check_required',
    });
    expect(await gateway.signUp({ email: 'a@b.co', password: 'long enough password' })).toEqual({
      ok: false,
      reason: 'check_required',
    });
    expect(service.signIn).not.toHaveBeenCalled();
    expect(service.signUp).not.toHaveBeenCalled();
  });

  it('passes the token to the check and continues when it passes', async () => {
    const { gateway, check } = withCheck(true);
    const result = await gateway.signIn({ email: 'a@b.co', password: 'x', challengeToken: 'tok' });
    expect(result.ok).toBe(true);
    expect(check).toHaveBeenCalledWith('tok', null);
    const up = await gateway.signUp({
      email: 'a@b.co',
      password: 'long enough password',
      challengeToken: 'tok2',
    });
    expect(up.ok).toBe(true);
    expect(check).toHaveBeenLastCalledWith('tok2', null);
  });

  it('does nothing extra when no check is configured', async () => {
    const { gateway } = setup(signedIn);
    expect((await gateway.signIn({ email: 'a@b.co', password: 'x' })).ok).toBe(true);
  });
});
