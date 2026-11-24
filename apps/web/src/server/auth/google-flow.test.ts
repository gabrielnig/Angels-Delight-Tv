import { FieldErrors, InvalidCredentials } from '@ad/auth';
import { RateLimited } from '@ad/shared';
import { describe, expect, it, vi } from 'vitest';
import { GoogleFlow, type GoogleIo } from './google-flow';

const actor = { accountId: 'a1', role: 'viewer' as const, sessionId: 's1' };

function setup(service: Record<string, unknown>, over: Partial<GoogleIo> = {}, enabled = true) {
  const io: GoogleIo = {
    meta: async () => ({ ip: null, ipTrunc: null, userAgent: null, requestId: null }),
    currentActor: vi.fn(async () => null as typeof actor | null),
    setSession: vi.fn(async () => undefined),
    setTwoStepPending: vi.fn(async () => undefined),
    setState: vi.fn(async () => undefined),
    readState: vi.fn(async () => 'STATE'),
    clearState: vi.fn(async () => undefined),
    setNote: vi.fn(async () => undefined),
    readNote: vi.fn(async () => 'NOTE'),
    clearNote: vi.fn(async () => undefined),
    ...over,
  };
  return { flow: new GoogleFlow(service as never, io, async () => enabled), io };
}

describe('GoogleFlow.start', () => {
  it('is not available when the flow is switched off', async () => {
    const begin = vi.fn();
    const { flow } = setup({ begin }, {}, false);
    expect(await flow.start({ next: '/x' })).toEqual({ kind: 'not_found' });
    expect(begin).not.toHaveBeenCalled();
  });

  it('stores the signed state and sends the browser to Google, with a sanitised next', async () => {
    const begin = vi.fn(async () => ({
      url: 'https://accounts.google.com/x',
      cookie: 'C',
      maxAge: 600,
    }));
    const { flow, io } = setup({ begin });
    expect(await flow.start({ next: 'https://evil.test' })).toEqual({
      kind: 'redirect',
      url: 'https://accounts.google.com/x',
    });
    expect(begin).toHaveBeenCalledWith(
      { next: '/profiles', linkAccountId: undefined },
      expect.anything(),
    );
    expect(io.setState).toHaveBeenCalledWith('C', 600);
  });

  it('a connect request needs a signed in person', async () => {
    const begin = vi.fn(async () => ({ url: 'u', cookie: 'C', maxAge: 600 }));
    const none = setup({ begin });
    expect(await none.flow.start({ link: true })).toEqual({ kind: 'sign_in' });
    const signedIn = setup({ begin }, { currentActor: vi.fn(async () => actor) });
    await signedIn.flow.start({ link: true });
    expect(begin).toHaveBeenCalledWith(
      { next: '/account/security', linkAccountId: 'a1' },
      expect.anything(),
    );
  });

  it('a rate limited start lands on the generic failure page', async () => {
    const { flow } = setup({
      begin: async () => {
        throw new RateLimited(30);
      },
    });
    expect(await flow.start({})).toEqual({ kind: 'failed' });
  });
});

describe('GoogleFlow.callback', () => {
  const run = (outcome: unknown, over: Partial<GoogleIo> = {}) => {
    const complete = vi.fn(async () => outcome);
    const made = setup({ complete }, over);
    return { ...made, complete };
  };

  it('clears the state and shows the generic page without a cookie or on any failure', async () => {
    const { flow, io } = run({ status: 'failed' });
    expect(await flow.callback({ code: 'c', state: 's' })).toEqual({
      redirect: '/sign-in/google-failed',
    });
    expect(io.clearState).toHaveBeenCalled();
    expect(io.setSession).not.toHaveBeenCalled();
  });

  it('opens the session and lands on a sanitised next', async () => {
    const { flow, io } = run({
      status: 'signed_in',
      accountId: 'a1',
      session: { token: 'T', id: 's' },
      next: '/library',
      created: false,
    });
    expect(await flow.callback({ code: 'c', state: 's' })).toEqual({ redirect: '/library' });
    expect(io.setSession).toHaveBeenCalledWith('T', 'viewer');
    const bad = run({
      status: 'signed_in',
      accountId: 'a1',
      session: { token: 'T', id: 's' },
      next: '//evil.test',
      created: false,
    });
    expect(await bad.flow.callback({})).toEqual({ redirect: '/profiles' });
  });

  it('a new account goes to the consent screen with the note, and no session', async () => {
    const { flow, io } = run({
      status: 'finish_signup',
      pendingToken: 'N',
      next: '/x',
      hint: 'g***@x.co',
    });
    expect(await flow.callback({ code: 'c', state: 's' })).toEqual({ redirect: '/sign-up/google' });
    expect(io.setNote).toHaveBeenCalledWith('N', 600);
    expect(io.setSession).not.toHaveBeenCalled();
  });

  it('an existing password account goes to the link confirmation page', async () => {
    const { flow, io } = run({ status: 'confirm_link', pendingToken: 'N', next: '/x' });
    expect(await flow.callback({})).toEqual({ redirect: '/sign-in/link-google' });
    expect(io.setNote).toHaveBeenCalledWith('N', 600);
  });

  it('two step accounts go to the code screen and get no session', async () => {
    const { flow, io } = run({
      status: 'mfa_required',
      accountId: 'a1',
      pendingToken: 'P',
      next: '/library',
    });
    expect(await flow.callback({})).toEqual({
      redirect: `/sign-in/verify?next=${encodeURIComponent('/library')}`,
    });
    expect(io.setTwoStepPending).toHaveBeenCalledWith('P');
    expect(io.setSession).not.toHaveBeenCalled();
  });

  it('pending deletion lands on the cancel screen', async () => {
    const { flow } = run({
      status: 'pending_deletion',
      accountId: 'a1',
      purgeAfter: new Date(),
      session: { token: 'T', id: 's' },
      next: '/x',
    });
    expect(await flow.callback({})).toEqual({ redirect: '/account/deletion' });
  });

  it('a connect returns to Security with a notice', async () => {
    const { flow } = run({ status: 'linked', next: '/account/security' });
    expect(await flow.callback({})).toEqual({ redirect: '/account/security?notice=google' });
  });

  it('passes the signed in person to the service for a connect', async () => {
    const { flow, complete } = run(
      { status: 'failed' },
      { currentActor: vi.fn(async () => actor) },
    );
    await flow.callback({ code: 'c', state: 's' });
    expect(complete).toHaveBeenCalledWith(
      { code: 'c', state: 's', error: undefined },
      'STATE',
      expect.anything(),
      actor,
    );
  });
});

describe('GoogleFlow confirm link and finish sign up', () => {
  it('confirm link signs in on the right password and keeps the note on a wrong one', async () => {
    const ok = setup({
      confirmLink: async () => ({
        status: 'signed_in',
        accountId: 'a1',
        session: { token: 'T', id: 's' },
        next: '/library',
        created: false,
      }),
    });
    expect(await ok.flow.confirmLink('pw')).toEqual({ ok: true, next: '/library' });
    expect(ok.io.setSession).toHaveBeenCalledWith('T', 'viewer');
    expect(ok.io.clearNote).toHaveBeenCalled();

    const wrong = setup({
      confirmLink: async () => {
        throw new FieldErrors({ password: 'Password is not right' });
      },
    });
    expect(await wrong.flow.confirmLink('pw')).toEqual({ ok: false, reason: 'wrong' });
    expect(wrong.io.clearNote).not.toHaveBeenCalled();

    const locked = setup({
      confirmLink: async () => {
        throw new RateLimited(600);
      },
    });
    expect(await locked.flow.confirmLink('pw')).toEqual({
      ok: false,
      reason: 'locked',
      minutes: 10,
    });

    const expired = setup({
      confirmLink: async () => {
        throw new InvalidCredentials();
      },
    });
    expect(await expired.flow.confirmLink('pw')).toEqual({ ok: false, reason: 'expired' });
    expect(expired.io.clearNote).toHaveBeenCalled();
  });

  it('confirm link with a two step account hands over to the code screen', async () => {
    const { flow, io } = setup({
      confirmLink: async () => ({
        status: 'mfa_required',
        accountId: 'a1',
        pendingToken: 'P',
        next: '/library',
      }),
    });
    expect(await flow.confirmLink('pw')).toEqual({
      ok: true,
      next: `/sign-in/verify?next=${encodeURIComponent('/library')}`,
    });
    expect(io.setTwoStepPending).toHaveBeenCalledWith('P');
  });

  it('finish sign up needs both consents and sends no session until it passes', async () => {
    const finish = vi.fn(async () => ({
      status: 'signed_in',
      accountId: 'a1',
      session: { token: 'T', id: 's' },
      next: '/library',
      created: true,
    }));
    const { flow, io } = setup({ finishSignUp: finish });
    expect(await flow.finishSignUp({ acceptTerms: true, guardianDeclaration: true })).toEqual({
      ok: true,
      next: '/library',
    });
    expect(io.setSession).toHaveBeenCalledWith('T', 'viewer');
    const missing = setup({
      finishSignUp: async () => {
        throw new FieldErrors({ acceptTerms: 'Accept the terms to continue' });
      },
    });
    expect(
      await missing.flow.finishSignUp({ acceptTerms: false, guardianDeclaration: true }),
    ).toEqual({
      ok: false,
      reason: 'fields',
      fields: { acceptTerms: 'Accept the terms to continue' },
    });
  });

  it('with no note the screens redirect and confirming says expired', async () => {
    const { flow } = setup({}, { readNote: vi.fn(async () => undefined) });
    expect(await flow.noteInfo()).toBeNull();
    expect(await flow.confirmLink('pw')).toEqual({ ok: false, reason: 'expired' });
  });

  it('reads the masked address from the note through the service', async () => {
    const { flow } = setup({ peekNote: () => ({ kind: 'link', hint: 'c***@example.com' }) });
    expect(await flow.noteInfo()).toEqual({ kind: 'link', hint: 'c***@example.com' });
  });
});

describe('GoogleFlow security card', () => {
  it('has no card when Google is switched off', async () => {
    const { flow } = setup({}, {}, false);
    expect(await flow.cardState()).toBeNull();
  });

  it('shows the masked address and whether a password is set', async () => {
    const identityStatus = vi.fn(async () => ({
      linked: true,
      hint: 'g***@example.com',
      linkedAt: new Date('2026-03-01T10:00:00Z'),
      hasPassword: false,
    }));
    const { flow } = setup({ identityStatus }, { currentActor: vi.fn(async () => actor) });
    expect(await flow.cardState()).toEqual({
      linked: true,
      hint: 'g***@example.com',
      hasPassword: false,
    });
    const out = setup({ identityStatus }, { currentActor: vi.fn(async () => null) });
    expect(await out.flow.cardState()).toBeNull();
  });

  it('unlink maps the service answers to plain results', async () => {
    const who = { currentActor: vi.fn(async () => actor) };
    const ok = setup({ unlink: vi.fn(async () => undefined) }, who);
    expect(await ok.flow.unlink('pw')).toEqual({ ok: true });

    const setPassword = setup(
      {
        unlink: async () => {
          throw new FieldErrors({ password: 'Set a password first' });
        },
      },
      who,
    );
    expect(await setPassword.flow.unlink('')).toEqual({ ok: false, reason: 'set_password' });

    const wrong = setup(
      {
        unlink: async () => {
          throw new FieldErrors({ password: 'Password is not right' });
        },
      },
      who,
    );
    expect(await wrong.flow.unlink('x')).toEqual({ ok: false, reason: 'wrong_password' });

    const locked = setup(
      {
        unlink: async () => {
          throw new RateLimited(900);
        },
      },
      who,
    );
    expect(await locked.flow.unlink('x')).toEqual({ ok: false, reason: 'locked', minutes: 15 });

    const signedOut = setup({}, { currentActor: vi.fn(async () => null) });
    expect(await signedOut.flow.unlink('x')).toEqual({ ok: false, reason: 'network' });
  });
});
