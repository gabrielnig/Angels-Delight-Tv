import { schema } from '@ad/db';
import { integrationEnabled } from '@ad/db/testing';
import { LimiterUnavailable, RateLimiter } from '@ad/security';
import { RateLimited } from '@ad/shared';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AccountService } from './accounts';
import { emailHash } from './identifiers';
import { PasswordHasher } from './password';
import { createAuthHarness, TEST_PASSWORD, type AuthHarness } from './testing';
import { AccountUnavailable, FieldErrors, InvalidCredentials, TokenRejected } from './types';

describe.skipIf(!integrationEnabled())('sign in, lockout, sign out and password recovery', () => {
  let h: AuthHarness;
  let auth: AccountService;
  let counter = 0;
  const fresh = () => `member${++counter}@example.com`;

  beforeAll(async () => {
    h = await createAuthHarness();
    auth = new AccountService(h.deps);
  });
  afterAll(async () => {
    await h.drop();
  });

  async function member(options: { verified?: boolean; password?: string } = {}) {
    const email = fresh();
    const password = options.password ?? TEST_PASSWORD;
    await auth.signUp({ email, password, acceptTerms: true, guardianDeclaration: true }, h.meta);
    if (options.verified !== false)
      await auth.verifyCode({ email, code: h.codeFor(email) }, h.meta);
    const hash = Buffer.from(emailHash(email, h.deps.pepper));
    const [row] = await h.dbs.admin.db
      .select()
      .from(schema.accounts)
      .where(eq(schema.accounts.emailHash, hash));
    return { email, password, id: row!.id };
  }

  const wrongTimes = async (email: string, times: number, meta = h.meta) => {
    for (let i = 0; i < times; i++) {
      await auth.signIn({ email, password: 'definitely-wrong-1' }, meta).catch(() => undefined);
    }
  };

  describe('signIn', () => {
    it('starts a viewer session for valid credentials and records the login', async () => {
      const m = await member();
      const result = await auth.signIn({ email: m.email, password: m.password }, h.meta);
      expect(result.status).toBe('signed_in');
      if (result.status !== 'signed_in') return;
      const context = await h.deps.sessions.validate(result.session.token);
      expect(context).toMatchObject({ accountId: m.id, role: 'viewer', mfaVerified: false });
      const [row] = await h.dbs.admin.db
        .select()
        .from(schema.accounts)
        .where(eq(schema.accounts.id, m.id));
      expect(row?.lastLoginAt).not.toBeNull();
      const audit = await h.dbs.admin.db
        .select()
        .from(schema.auditLog)
        .where(eq(schema.auditLog.action, 'auth.login'));
      expect(audit.some((a) => a.outcome === 'success' && a.actorAccountId === m.id)).toBe(true);
    });

    it('accepts a differently cased address', async () => {
      const m = await member();
      const result = await auth.signIn(
        { email: ` ${m.email.toUpperCase()}`, password: m.password },
        h.meta,
      );
      expect(result.status).toBe('signed_in');
    });

    it('gives the same error for a wrong password and an unknown email', async () => {
      const m = await member();
      const wrong = await auth
        .signIn({ email: m.email, password: 'not-the-password-1' }, h.meta)
        .catch((e: unknown) => e);
      const unknown = await auth
        .signIn({ email: 'nobody@example.com', password: 'not-the-password-1' }, h.meta)
        .catch((e: unknown) => e);
      expect(wrong).toBeInstanceOf(InvalidCredentials);
      expect(unknown).toBeInstanceOf(InvalidCredentials);
      expect((wrong as Error).message).toBe((unknown as Error).message);
    });

    it('spends a dummy hash for an unknown email so timing does not give it away', async () => {
      let dummies = 0;
      const hasher = new PasswordHasher({ memoryKib: 8, timeCost: 1, parallelism: 1 });
      const original = hasher.verifyDummy.bind(hasher);
      hasher.verifyDummy = async (password: string) => {
        dummies++;
        return original(password);
      };
      const spy = new AccountService({ ...h.deps, hasher });
      await spy
        .signIn({ email: 'ghost@example.com', password: 'whatever-12345' }, h.meta)
        .catch(() => undefined);
      expect(dummies).toBe(1);
    });

    it('sends an unverified account to verification with a fresh code instead of a session', async () => {
      const m = await member({ verified: false });
      const before = h.mailsTo(m.email);
      const result = await auth.signIn({ email: m.email, password: m.password }, h.meta);
      expect(result).toEqual({ status: 'needs_verification', email: m.email });
      await h.settle();
      expect(h.mailsTo(m.email)).toBe(before + 1);
    });

    it('does not reveal an unverified account to someone with the wrong password', async () => {
      const m = await member({ verified: false });
      await expect(
        auth.signIn({ email: m.email, password: 'wrong-password-12' }, h.meta),
      ).rejects.toBeInstanceOf(InvalidCredentials);
    });

    it('refuses a suspended account only after the right password and creates no session', async () => {
      const m = await member();
      await h.dbs.admin.db
        .update(schema.accounts)
        .set({ status: 'suspended' })
        .where(eq(schema.accounts.id, m.id));
      await expect(
        auth.signIn({ email: m.email, password: m.password }, h.meta),
      ).rejects.toBeInstanceOf(AccountUnavailable);
      await expect(
        auth.signIn({ email: m.email, password: 'wrong-password-12' }, h.meta),
      ).rejects.toBeInstanceOf(InvalidCredentials);
      const sessions = await h.dbs.admin.db
        .select()
        .from(schema.sessions)
        .where(eq(schema.sessions.accountId, m.id));
      expect(sessions.filter((s) => s.revokedAt === null)).toHaveLength(1);
    });

    it('refuses a staff account in the viewer form: no session, an admin login hint only with the right password (L-6)', async () => {
      const m = await member();
      await h.dbs.admin.db
        .update(schema.accounts)
        .set({ role: 'editor' })
        .where(eq(schema.accounts.id, m.id));
      const before = await h.dbs.admin.db
        .select()
        .from(schema.sessions)
        .where(eq(schema.sessions.accountId, m.id));
      const result = await auth.signIn({ email: m.email, password: m.password }, h.meta);
      expect(result).toEqual({ status: 'use_admin_login' });
      const after = await h.dbs.admin.db
        .select()
        .from(schema.sessions)
        .where(eq(schema.sessions.accountId, m.id));
      expect(after).toHaveLength(before.length);
      // A wrong password on a staff email looks exactly like a wrong password on any other email.
      await expect(
        auth.signIn({ email: m.email, password: 'wrong-password-12' }, h.meta),
      ).rejects.toBeInstanceOf(InvalidCredentials);
    });

    it('rehashes the password when the stored parameters are stale', async () => {
      const m = await member();
      const stronger = new AccountService({
        ...h.deps,
        hasher: new PasswordHasher({ memoryKib: 16, timeCost: 1, parallelism: 1 }),
      });
      await stronger.signIn({ email: m.email, password: m.password }, h.meta);
      const [row] = await h.dbs.admin.db
        .select()
        .from(schema.accounts)
        .where(eq(schema.accounts.id, m.id));
      expect(row?.passwordHash).toContain('m=16,t=1,p=1');
    });
  });

  describe('lockout', () => {
    it('locks after five failures and refuses even the right password, with the wait time', async () => {
      const m = await member();
      await wrongTimes(m.email, 5);
      const error = await auth
        .signIn({ email: m.email, password: m.password }, h.meta)
        .catch((e: unknown) => e);
      expect(error).toBeInstanceOf(RateLimited);
      expect((error as RateLimited).retryAfterSeconds).toBeGreaterThan(890);
      expect((error as RateLimited).retryAfterSeconds).toBeLessThanOrEqual(900);
    });

    it('locks an unknown address the same way, so a lock does not prove an account exists', async () => {
      await wrongTimes('ghost-lock@example.com', 5);
      await expect(
        auth.signIn({ email: 'ghost-lock@example.com', password: 'x'.repeat(12) }, h.meta),
      ).rejects.toBeInstanceOf(RateLimited);
    });

    it('unlocks after fifteen minutes and a good sign in resets the counter', async () => {
      const m = await member();
      await wrongTimes(m.email, 5);
      h.advance(15 * 60 + 1);
      expect((await auth.signIn({ email: m.email, password: m.password }, h.meta)).status).toBe(
        'signed_in',
      );
      await wrongTimes(m.email, 4);
      expect((await auth.signIn({ email: m.email, password: m.password }, h.meta)).status).toBe(
        'signed_in',
      );
    });

    it('mails the owner once when the lock starts, and audits it', async () => {
      const m = await member();
      const before = h.mailsTo(m.email);
      await wrongTimes(m.email, 5);
      await h.settle();
      expect(h.mailsTo(m.email)).toBe(before + 1);
      expect(h.transport.outbox.at(-1)?.subject).toMatch(/several failed sign-in attempts/i);
      await wrongTimes(m.email, 3);
      h.advance(15 * 60 + 1);
      await wrongTimes(m.email, 5);
      await h.settle();
      expect(h.mailsTo(m.email)).toBe(before + 1);
      const audit = await h.dbs.admin.db
        .select()
        .from(schema.auditLog)
        .where(eq(schema.auditLog.action, 'auth.lockout'));
      expect(audit.length).toBeGreaterThan(0);
    });

    it('sends no email for an address that has no account', async () => {
      const before = h.transport.outbox.length;
      await wrongTimes('ghost-mail@example.com', 5);
      await h.settle();
      expect(h.transport.outbox.length).toBe(before);
    });

    it('does not sign out sessions that already exist', async () => {
      const m = await member();
      const live = await auth.signIn({ email: m.email, password: m.password }, h.meta);
      if (live.status !== 'signed_in') throw new Error('expected a session');
      await wrongTimes(m.email, 5);
      expect(await h.deps.sessions.validate(live.session.token)).not.toBeNull();
    });

    it('limits one address to twenty failures across accounts', async () => {
      const meta = { ...h.meta, ip: '192.0.2.99', ipTrunc: '192.0.2.0/24' };
      for (let i = 0; i < 20; i++) {
        await auth
          .signIn({ email: `spray${i}@example.com`, password: 'x'.repeat(12) }, meta)
          .catch(() => undefined);
      }
      const m = await member();
      await expect(
        auth.signIn({ email: m.email, password: m.password }, meta),
      ).rejects.toBeInstanceOf(RateLimited);
    });

    it('fails closed when the limiter store is down', async () => {
      const broken = new RateLimiter({
        transaction: () => Promise.reject(new Error('down')),
        execute: () => Promise.reject(new Error('down')),
      } as never);
      const closed = new AccountService({ ...h.deps, limiter: broken });
      const m = await member();
      await expect(
        closed.signIn({ email: m.email, password: m.password }, h.meta),
      ).rejects.toBeInstanceOf(LimiterUnavailable);
    });
  });

  describe('signOut', () => {
    it('revokes the session on the server', async () => {
      const m = await member();
      const result = await auth.signIn({ email: m.email, password: m.password }, h.meta);
      if (result.status !== 'signed_in') throw new Error('expected a session');
      await auth.signOut(result.session.token, h.meta);
      expect(await h.deps.sessions.validate(result.session.token)).toBeNull();
    });

    it('does not throw for an unknown or empty token', async () => {
      await expect(auth.signOut('nope', h.meta)).resolves.toBeUndefined();
      await expect(auth.signOut('', h.meta)).resolves.toBeUndefined();
    });
  });

  describe('password reset', () => {
    it('mails a single use link and voids the previous link', async () => {
      const m = await member();
      await auth.requestPasswordReset({ email: m.email }, h.meta);
      await h.settle();
      const first = h.tokenFor(m.email);
      await auth.requestPasswordReset({ email: m.email }, h.meta);
      await h.settle();
      const second = h.tokenFor(m.email);
      expect(second).not.toBe(first);
      await expect(
        auth.resetPassword({ token: first, password: 'a-brand-new-secret-7' }, h.meta),
      ).rejects.toMatchObject({ problem: 'used' });
      await expect(
        auth.resetPassword({ token: second, password: 'a-brand-new-secret-7' }, h.meta),
      ).resolves.toBeUndefined();
    });

    it('does nothing visible for an unknown address', async () => {
      const before = h.transport.outbox.length;
      await expect(
        auth.requestPasswordReset({ email: 'nobody-here@example.com' }, h.meta),
      ).resolves.toBeUndefined();
      await h.settle();
      expect(h.transport.outbox.length).toBe(before);
    });

    it('stops mailing after three requests an hour but answers the same', async () => {
      const m = await member();
      const before = h.mailsTo(m.email);
      for (let i = 0; i < 5; i++) await auth.requestPasswordReset({ email: m.email }, h.meta);
      await h.settle();
      expect(h.mailsTo(m.email)).toBe(before + 3);
    });

    it('offers verification instead of a reset to an unverified account, and mails nothing to a suspended one', async () => {
      const unverified = await member({ verified: false });
      const before = h.mailsTo(unverified.email);
      await auth.requestPasswordReset({ email: unverified.email }, h.meta);
      await h.settle();
      expect(h.mailsTo(unverified.email)).toBe(before + 1);
      expect(h.transport.outbox.at(-1)?.subject).toMatch(/confirm your email/i);

      const suspended = await member();
      await h.dbs.admin.db
        .update(schema.accounts)
        .set({ status: 'suspended' })
        .where(eq(schema.accounts.id, suspended.id));
      const mails = h.mailsTo(suspended.email);
      await auth.requestPasswordReset({ email: suspended.email }, h.meta);
      await h.settle();
      expect(h.mailsTo(suspended.email)).toBe(mails);
    });

    it('sets the new password, revokes every session, clears a lock and sends a notice', async () => {
      const m = await member();
      const live = await auth.signIn({ email: m.email, password: m.password }, h.meta);
      if (live.status !== 'signed_in') throw new Error('expected a session');
      await wrongTimes(m.email, 5);
      await auth.requestPasswordReset({ email: m.email }, h.meta);
      await h.settle();
      const before = h.mailsTo(m.email);
      await auth.resetPassword(
        { token: h.tokenFor(m.email), password: 'a-brand-new-secret-7' },
        h.meta,
      );
      await h.settle();
      expect(await h.deps.sessions.validate(live.session.token)).toBeNull();
      expect(h.mailsTo(m.email)).toBe(before + 1);
      expect(h.transport.outbox.at(-1)?.subject).toMatch(/password was changed/i);
      expect(
        (await auth.signIn({ email: m.email, password: 'a-brand-new-secret-7' }, h.meta)).status,
      ).toBe('signed_in');
      await expect(
        auth.signIn({ email: m.email, password: m.password }, h.meta),
      ).rejects.toBeInstanceOf(InvalidCredentials);
    });

    it('rejects an expired, reused or made up link', async () => {
      const m = await member();
      await auth.requestPasswordReset({ email: m.email }, h.meta);
      await h.settle();
      const token = h.tokenFor(m.email);
      h.advance(30 * 60 + 1);
      await expect(
        auth.resetPassword({ token, password: 'a-brand-new-secret-7' }, h.meta),
      ).rejects.toMatchObject({ problem: 'expired' });
      await expect(
        auth.resetPassword({ token: 'garbage', password: 'a-brand-new-secret-7' }, h.meta),
      ).rejects.toBeInstanceOf(TokenRejected);
    });

    it('keeps the link usable after a weak password is refused', async () => {
      const m = await member();
      await auth.requestPasswordReset({ email: m.email }, h.meta);
      await h.settle();
      const token = h.tokenFor(m.email);
      await expect(auth.resetPassword({ token, password: 'short' }, h.meta)).rejects.toBeInstanceOf(
        FieldErrors,
      );
      await expect(
        auth.resetPassword({ token, password: m.password }, h.meta),
      ).rejects.toMatchObject({ fields: { password: expect.stringMatching(/different/i) } });
      await expect(
        auth.resetPassword({ token, password: 'a-brand-new-secret-7' }, h.meta),
      ).resolves.toBeUndefined();
    });
  });

  describe('changePassword', () => {
    async function signedIn() {
      const m = await member();
      const result = await auth.signIn({ email: m.email, password: m.password }, h.meta);
      if (result.status !== 'signed_in') throw new Error('expected a session');
      const second = await auth.signIn({ email: m.email, password: m.password }, h.meta);
      if (second.status !== 'signed_in') throw new Error('expected a session');
      return {
        ...m,
        session: result.session,
        other: second.session,
        actor: { accountId: m.id, role: 'viewer' as const, sessionId: result.session.id },
      };
    }

    it('changes the password, ends other sessions, rotates this one and mails a notice', async () => {
      const s = await signedIn();
      const before = h.mailsTo(s.email);
      const result = await auth.changePassword(
        s.actor,
        { currentPassword: s.password, newPassword: 'another-fine-secret-3' },
        h.meta,
      );
      await h.settle();
      expect(await h.deps.sessions.validate(s.other.token)).toBeNull();
      expect(await h.deps.sessions.validate(s.session.token)).toBeNull();
      expect(await h.deps.sessions.validate(result.session.token)).not.toBeNull();
      expect(h.mailsTo(s.email)).toBe(before + 1);
      expect(
        (await auth.signIn({ email: s.email, password: 'another-fine-secret-3' }, h.meta)).status,
      ).toBe('signed_in');
    });

    it('says the current password is not right and counts it toward the lockout', async () => {
      const s = await signedIn();
      await expect(
        auth.changePassword(
          s.actor,
          { currentPassword: 'nope-nope-nope-1', newPassword: 'another-fine-secret-3' },
          h.meta,
        ),
      ).rejects.toMatchObject({
        fields: { currentPassword: 'Current password is not right' },
      });
      for (let i = 0; i < 4; i++)
        await auth
          .changePassword(
            s.actor,
            { currentPassword: 'nope-nope-nope-1', newPassword: 'another-fine-secret-3' },
            h.meta,
          )
          .catch(() => undefined);
      await expect(
        auth.changePassword(
          s.actor,
          { currentPassword: s.password, newPassword: 'another-fine-secret-3' },
          h.meta,
        ),
      ).rejects.toBeInstanceOf(RateLimited);
    });

    it('refuses the same password and weak passwords', async () => {
      const s = await signedIn();
      await expect(
        auth.changePassword(
          s.actor,
          { currentPassword: s.password, newPassword: s.password },
          h.meta,
        ),
      ).rejects.toMatchObject({ fields: { newPassword: expect.stringMatching(/different/i) } });
      await expect(
        auth.changePassword(s.actor, { currentPassword: s.password, newPassword: 'short' }, h.meta),
      ).rejects.toBeInstanceOf(FieldErrors);
    });
  });

  describe('signOutEverywhere', () => {
    it('needs the password and then ends every session including this one', async () => {
      const m = await member();
      const a = await auth.signIn({ email: m.email, password: m.password }, h.meta);
      const b = await auth.signIn({ email: m.email, password: m.password }, h.meta);
      if (a.status !== 'signed_in' || b.status !== 'signed_in')
        throw new Error('expected sessions');
      const actor = { accountId: m.id, role: 'viewer' as const, sessionId: a.session.id };
      await expect(
        auth.signOutEverywhere(actor, 'wrong-password-12', h.meta),
      ).rejects.toBeInstanceOf(FieldErrors);
      expect(await h.deps.sessions.validate(b.session.token)).not.toBeNull();
      await auth.signOutEverywhere(actor, m.password, h.meta);
      expect(await h.deps.sessions.validate(a.session.token)).toBeNull();
      expect(await h.deps.sessions.validate(b.session.token)).toBeNull();
    });
  });
});
