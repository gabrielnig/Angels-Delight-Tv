import { schema } from '@ad/db';
import { integrationEnabled } from '@ad/db/testing';
import { RateLimited } from '@ad/shared';
import { MailDeliveryError } from '@ad/mailer';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AccountService } from './accounts';
import { emailHash } from './identifiers';
import { createAuthHarness, TEST_PASSWORD, type AuthHarness } from './testing';
import { FieldErrors, SignUpClosed } from './types';

const input = (email: string, extra: Record<string, unknown> = {}) => ({
  email,
  password: TEST_PASSWORD,
  acceptTerms: true,
  guardianDeclaration: true,
  ...extra,
});

describe.skipIf(!integrationEnabled())('sign up and email verification', () => {
  let h: AuthHarness;
  let auth: AccountService;
  let counter = 0;
  const fresh = () => `viewer${++counter}@example.com`;

  beforeAll(async () => {
    h = await createAuthHarness();
    auth = new AccountService(h.deps);
  });
  afterAll(async () => {
    await h.drop();
  });

  const accountRow = async (email: string) => {
    const hash = Buffer.from(emailHash(email, h.deps.pepper));
    const [row] = await h.dbs.admin.db
      .select()
      .from(schema.accounts)
      .where(eq(schema.accounts.emailHash, hash));
    return row;
  };

  describe('signUp', () => {
    it('creates an unverified viewer with encrypted email, argon2id password, consents and a key', async () => {
      const email = fresh();
      const result = await auth.signUp(input(email), h.meta);
      expect(result).toEqual({ email, emailSent: true });
      const row = await accountRow(email);
      expect(row).toMatchObject({ role: 'viewer', status: 'active', emailVerifiedAt: null });
      expect(row?.passwordHash).toMatch(/^\$argon2id\$/);
      expect(Buffer.from(row!.emailEnc!).includes(Buffer.from(email))).toBe(false);
      const consents = await h.dbs.admin.db
        .select()
        .from(schema.consents)
        .where(eq(schema.consents.accountId, row!.id));
      expect(consents.map((c) => c.kind).sort()).toEqual([
        'guardian_declaration',
        'privacy',
        'terms',
      ]);
      const keys = await h.dbs.admin.keysPool.query(
        'SELECT 1 FROM user_keys WHERE account_id = $1',
        [row!.id],
      );
      expect(keys.rowCount).toBe(1);
      expect(await h.deps.keys.open(row!.id, 'email', row!.emailEnc!)).toBe(email);
    });

    it('mails a six digit code and a link, and keeps the code out of the subject', async () => {
      const email = fresh();
      await auth.signUp(input(email), h.meta);
      const mail = h.transport.outbox.filter((m) => m.to === email).at(-1);
      expect(mail?.subject).not.toMatch(/\d{6}/);
      expect(h.codeFor(email)).toMatch(/^\d{6}$/);
      expect(mail?.text).toContain('https://tv.example.org/verify-email/confirm?token=');
    });

    it('normalises the address so a differently cased duplicate is the same account', async () => {
      const email = fresh();
      const result = await auth.signUp(input(`  ${email.toUpperCase()} `), h.meta);
      expect(result.email).toBe(email);
      const before = await h.dbs.admin.db.select().from(schema.accounts);
      await auth.signUp(input(email), h.meta);
      expect(await h.dbs.admin.db.select().from(schema.accounts)).toHaveLength(before.length);
    });

    it('answers an existing address exactly like a new one and warns the owner by email', async () => {
      const email = fresh();
      const first = await auth.signUp(input(email), h.meta);
      const mailsBefore = h.mailsTo(email);
      const second = await auth.signUp(input(email, { password: 'another-long-secret-9' }), h.meta);
      await h.settle();
      expect(second).toEqual(first);
      expect(h.mailsTo(email)).toBe(mailsBefore + 1);
      expect(h.transport.outbox.at(-1)?.subject).toMatch(/tried to sign up/i);
    });

    it('rejects a weak password with a field error', async () => {
      await expect(
        auth.signUp(input(fresh(), { password: 'short' }), h.meta),
      ).rejects.toMatchObject({
        constructor: FieldErrors,
        fields: { password: expect.any(String) },
      });
      await expect(
        auth.signUp(input(fresh(), { password: 'password123' }), h.meta),
      ).rejects.toBeInstanceOf(FieldErrors);
    });

    it('rejects a malformed email and missing consents', async () => {
      await expect(auth.signUp(input('nope'), h.meta)).rejects.toMatchObject({
        fields: { email: expect.any(String) },
      });
      await expect(
        auth.signUp(input(fresh(), { guardianDeclaration: false }), h.meta),
      ).rejects.toMatchObject({ fields: { guardianDeclaration: expect.any(String) } });
      await expect(
        auth.signUp(input(fresh(), { acceptTerms: false }), h.meta),
      ).rejects.toMatchObject({
        fields: { acceptTerms: expect.any(String) },
      });
    });

    it('rejects a password found in a breach list', async () => {
      const strict = new AccountService({ ...h.deps, isBreached: async () => true });
      await expect(strict.signUp(input(fresh()), h.meta)).rejects.toMatchObject({
        fields: { password: expect.stringMatching(/data breach/i) },
      });
    });

    it('silently drops a submission that fills the honeypot field', async () => {
      const email = fresh();
      const result = await auth.signUp(input(email, { website: 'http://spam.example' }), h.meta);
      expect(result).toEqual({ email, emailSent: true });
      expect(await accountRow(email)).toBeUndefined();
      expect(h.mailsTo(email)).toBe(0);
    });

    it('limits sign ups to five per hour from one address', async () => {
      const meta = { ...h.meta, ip: '198.51.100.20', ipTrunc: '198.51.100.0/24' };
      for (let i = 0; i < 5; i++) await auth.signUp(input(fresh()), meta);
      await expect(auth.signUp(input(fresh()), meta)).rejects.toBeInstanceOf(RateLimited);
    });

    it('still creates the account when the email provider fails and says so', async () => {
      const email = fresh();
      h.transport.failNext(new Error('smtp down'));
      const result = await auth.signUp(input(email), h.meta);
      expect(result.emailSent).toBe(false);
      expect(await accountRow(email)).toBeDefined();
    });

    it('refuses when sign up is closed', async () => {
      const closed = new AccountService({ ...h.deps, config: { signUpOpen: false } });
      await expect(closed.signUp(input(fresh()), h.meta)).rejects.toBeInstanceOf(SignUpClosed);
    });

    it('records an audit entry without the email address', async () => {
      const email = fresh();
      await auth.signUp(input(email), h.meta);
      const rows = await h.dbs.admin.db
        .select()
        .from(schema.auditLog)
        .where(eq(schema.auditLog.action, 'auth.signup'));
      expect(rows.length).toBeGreaterThan(0);
      expect(JSON.stringify(rows)).not.toContain(email);
    });
  });

  describe('verifyCode', () => {
    it('activates the account, starts a session and consumes the code', async () => {
      const email = fresh();
      await auth.signUp(input(email), h.meta);
      const code = h.codeFor(email);
      const result = await auth.verifyCode({ email, code }, h.meta);
      expect(result.status).toBe('verified');
      expect(result.status === 'verified' && result.session.token).toBeTruthy();
      expect((await accountRow(email))?.emailVerifiedAt).not.toBeNull();
      expect((await auth.verifyCode({ email, code }, h.meta)).status).toBe('invalid');
    });

    it('rejects a wrong code, and voids the code after five wrong tries', async () => {
      const email = fresh();
      await auth.signUp(input(email), h.meta);
      const code = h.codeFor(email);
      const wrong = code === '000000' ? '000001' : '000000';
      for (let i = 0; i < 4; i++)
        expect((await auth.verifyCode({ email, code: wrong }, h.meta)).status).toBe('invalid');
      expect((await auth.verifyCode({ email, code: wrong }, h.meta)).status).toBe('too_many');
      expect((await auth.verifyCode({ email, code }, h.meta)).status).toBe('too_many');
    });

    it('expires the code after 15 minutes', async () => {
      const email = fresh();
      await auth.signUp(input(email), h.meta);
      const code = h.codeFor(email);
      h.advance(15 * 60 + 1);
      expect((await auth.verifyCode({ email, code }, h.meta)).status).toBe('expired');
    });

    it('treats an unknown address exactly like a wrong code', async () => {
      expect(
        (await auth.verifyCode({ email: 'nobody@example.com', code: '123456' }, h.meta)).status,
      ).toBe('invalid');
    });

    it('does not accept a code that is not six digits', async () => {
      const email = fresh();
      await auth.signUp(input(email), h.meta);
      expect((await auth.verifyCode({ email, code: '12ab56' }, h.meta)).status).toBe('invalid');
    });

    it('only the newest code works after a resend', async () => {
      const email = fresh();
      await auth.signUp(input(email), h.meta);
      const oldCode = h.codeFor(email);
      await auth.resendVerification({ email }, h.meta);
      const newCode = h.codeFor(email);
      if (newCode !== oldCode)
        expect((await auth.verifyCode({ email, code: oldCode }, h.meta)).status).toBe('invalid');
      expect((await auth.verifyCode({ email, code: newCode }, h.meta)).status).toBe('verified');
    });
  });

  describe('resendVerification', () => {
    it('allows three resends per hour and then asks to wait', async () => {
      const email = fresh();
      await auth.signUp(input(email), h.meta);
      for (let i = 0; i < 3; i++) await auth.resendVerification({ email }, h.meta);
      const before = h.mailsTo(email);
      await expect(auth.resendVerification({ email }, h.meta)).rejects.toBeInstanceOf(RateLimited);
      expect(h.mailsTo(email)).toBe(before);
    });

    it('sends nothing for an unknown address and only a heads up for a verified one', async () => {
      await expect(
        auth.resendVerification({ email: 'ghost@example.com' }, h.meta),
      ).resolves.toEqual({ sent: true });
      expect(h.mailsTo('ghost@example.com')).toBe(0);
      const email = fresh();
      await auth.signUp(input(email), h.meta);
      await auth.verifyCode({ email, code: h.codeFor(email) }, h.meta);
      const before = h.mailsTo(email);
      await expect(auth.resendVerification({ email }, h.meta)).resolves.toEqual({ sent: true });
      expect(h.mailsTo(email)).toBe(before + 1);
      expect(h.transport.outbox.at(-1)?.subject).toMatch(/tried to sign up/i);
    });

    it('reports a provider failure so the screen can say it could not send', async () => {
      const email = fresh();
      await auth.signUp(input(email), h.meta);
      h.transport.failNext(new Error('smtp down'));
      await expect(auth.resendVerification({ email }, h.meta)).rejects.toBeInstanceOf(
        MailDeliveryError,
      );
    });

    it('resendForToken lets an expired link request a fresh email', async () => {
      const email = fresh();
      await auth.signUp(input(email), h.meta);
      const token = h.tokenFor(email);
      h.advance(25 * 3600);
      const before = h.mailsTo(email);
      await auth.resendForToken(token, h.meta);
      expect(h.mailsTo(email)).toBe(before + 1);
      await expect(auth.resendForToken('garbage', h.meta)).resolves.toEqual({ sent: true });
    });
  });

  describe('verifyLink', () => {
    it('activates the account without starting a session', async () => {
      const email = fresh();
      await auth.signUp(input(email), h.meta);
      const result = await auth.verifyLink(h.tokenFor(email), h.meta);
      expect(result).toEqual({ status: 'verified', purpose: 'verify_email' });
      expect((await accountRow(email))?.emailVerifiedAt).not.toBeNull();
    });

    it('says already used the second time and invalid for a tampered link', async () => {
      const email = fresh();
      await auth.signUp(input(email), h.meta);
      const token = h.tokenFor(email);
      await auth.verifyLink(token, h.meta);
      expect((await auth.verifyLink(token, h.meta)).status).toBe('used');
      expect((await auth.verifyLink(`${token}x`, h.meta)).status).toBe('invalid');
      expect((await auth.verifyLink('', h.meta)).status).toBe('invalid');
    });

    it('expires after 24 hours', async () => {
      const email = fresh();
      await auth.signUp(input(email), h.meta);
      const token = h.tokenFor(email);
      h.advance(24 * 3600 + 1);
      expect((await auth.verifyLink(token, h.meta)).status).toBe('expired');
    });

    it('a link from before a resend no longer works', async () => {
      const email = fresh();
      await auth.signUp(input(email), h.meta);
      const oldToken = h.tokenFor(email);
      await auth.resendVerification({ email }, h.meta);
      expect((await auth.verifyLink(oldToken, h.meta)).status).toBe('used');
      expect((await auth.verifyLink(h.tokenFor(email), h.meta)).status).toBe('verified');
    });

    it('does not accept a password reset token as a verification link', async () => {
      const email = fresh();
      await auth.signUp(input(email), h.meta);
      await auth.verifyCode({ email, code: h.codeFor(email) }, h.meta);
      await auth.requestPasswordReset({ email }, h.meta);
      await h.settle();
      expect((await auth.verifyLink(h.tokenFor(email), h.meta)).status).toBe('invalid');
    });
  });
});
