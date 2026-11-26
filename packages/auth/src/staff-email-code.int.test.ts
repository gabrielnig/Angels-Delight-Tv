import { schema } from '@ad/db';
import { integrationEnabled } from '@ad/db/testing';
import { Conflict, Forbidden, RateLimited } from '@ad/shared';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { StaffService } from './staff';
import { base32Decode, totpAt } from './totp';
import {
  createAuthHarness,
  registerMember,
  TEST_PASSWORD,
  type AuthHarness,
  type TestMember,
} from './testing';
import { FieldErrors, ReauthRequired } from './types';

type Policy = 'email' | 'authenticator';

describe.skipIf(!integrationEnabled())('staff email code second step (L16, D-397)', () => {
  let h: AuthHarness;
  let staff: StaffService;
  let policy: Policy = 'email';
  let emailUp = true;
  let n = 0;
  const address = () => `mail2fa${++n}@example.org`;

  beforeAll(async () => {
    h = await createAuthHarness({
      secondStepPolicy: async () => policy,
      emailAvailable: () => emailUp,
    });
    staff = new StaffService(h.deps);
  });
  afterAll(async () => {
    await h.drop();
  });

  async function staffAccount(role: 'editor' | 'admin' | 'super_admin' = 'editor') {
    const member = await registerMember(h, staff);
    await h.dbs.admin.db
      .update(schema.accounts)
      .set({ role })
      .where(eq(schema.accounts.id, member.id));
    return { member, role };
  }
  const login = (member: TestMember) =>
    staff.adminSignIn({ email: member.email, password: member.password }, h.meta);
  const pendingOf = (member: TestMember, role: 'editor' | 'admin' | 'super_admin', id: string) => ({
    accountId: member.id,
    role,
    sessionId: id,
  });

  /** A staff member who has passed the emailed code and holds a full session. */
  async function signedIn(role: 'editor' | 'admin' | 'super_admin' = 'editor') {
    const { member } = await staffAccount(role);
    const first = await login(member);
    const pending = pendingOf(member, role, first.session.id);
    const done = await staff.verifyEmailCode(pending, { code: h.codeFor(member.email) }, h.meta);
    const context = await h.deps.sessions.validate(done.session.token);
    return {
      member,
      token: done.session.token,
      actor: { accountId: member.id, role, sessionId: context!.sessionId },
    };
  }

  describe('sign in', () => {
    it('mails a code after a correct password and returns a pending session', async () => {
      const { member } = await staffAccount('admin');
      const before = h.mailsTo(member.email);
      const result = await login(member);
      expect(result.status).toBe('email_code_required');
      expect(h.mailsTo(member.email)).toBe(before + 1);
      expect(await h.deps.sessions.validate(result.session.token)).toMatchObject({
        mfaVerified: false,
      });
    });

    it('sends nothing for a wrong password', async () => {
      const { member } = await staffAccount();
      const before = h.mailsTo(member.email);
      await expect(
        staff.adminSignIn({ email: member.email, password: 'wrong-password-99' }, h.meta),
      ).rejects.toBeDefined();
      expect(h.mailsTo(member.email)).toBe(before);
    });

    it('states time and coarse place, a not you step, and never a raw address', async () => {
      const { member } = await staffAccount();
      const meta = { ...h.meta, country: 'NG' };
      await staff.adminSignIn({ email: member.email, password: member.password }, meta);
      const mail = h.transport.outbox.filter((m) => m.to === member.email).at(-1)!;
      expect(mail.text).toContain('Nigeria');
      expect(mail.text).toContain('UTC');
      expect(mail.text.toLowerCase()).toContain('not you');
      expect(mail.text).toContain('/forgot-password');
      expect(mail.text).not.toContain(meta.ip!);
      expect(mail.html).not.toContain(meta.ip!);
      expect(mail.subject).not.toMatch(/\d{6}/);
    });

    it('keeps only a hash of the code, and it expires with the token after 10 minutes', async () => {
      const { member } = await staffAccount();
      await login(member);
      const code = h.codeFor(member.email);
      const rows = await h.dbs.admin.db.select().from(schema.verificationCodes);
      expect(rows.some((r) => Buffer.from(r.codeHash).toString('utf8').includes(code))).toBe(false);
      const token = (
        await h.dbs.admin.db
          .select()
          .from(schema.emailTokens)
          .where(eq(schema.emailTokens.accountId, member.id))
      ).find((row) => row.purpose === 'staff_sign_in');
      expect(token!.expiresAt.getTime() - token!.createdAt.getTime()).toBe(600_000);
    });

    it('accepts the code once, promotes the session and audits success', async () => {
      const { member, role } = await staffAccount('editor');
      const first = await login(member);
      const pending = pendingOf(member, role, first.session.id);
      const code = h.codeFor(member.email);
      const done = await staff.verifyEmailCode(pending, { code }, h.meta);
      expect(await h.deps.sessions.validate(done.session.token)).toMatchObject({
        mfaVerified: true,
        role: 'editor',
      });
      const second = await login(member);
      await expect(
        staff.verifyEmailCode(pendingOf(member, role, second.session.id), { code }, h.meta),
      ).rejects.toBeInstanceOf(FieldErrors);
      const actions = (await h.dbs.admin.db.select().from(schema.auditLog)).map((r) => r.action);
      expect(actions).toContain('admin.email_code_sent');
      expect(actions).toContain('admin.email_code_failed');
      expect(actions).toContain('admin.login');
    });

    it('rejects an expired code', async () => {
      const { member, role } = await staffAccount();
      const first = await login(member);
      const code = h.codeFor(member.email);
      h.advance(601);
      await expect(
        staff.verifyEmailCode(pendingOf(member, role, first.session.id), { code }, h.meta),
      ).rejects.toBeInstanceOf(FieldErrors);
    });

    it('stops a code after 5 wrong tries even when the right one follows', async () => {
      const { member, role } = await staffAccount();
      const first = await login(member);
      const pending = pendingOf(member, role, first.session.id);
      const code = h.codeFor(member.email);
      const wrong = code === '000000' ? '111111' : '000000';
      for (let i = 0; i < 5; i++)
        await expect(staff.verifyEmailCode(pending, { code: wrong }, h.meta)).rejects.toBeDefined();
      await expect(staff.verifyEmailCode(pending, { code }, h.meta)).rejects.toBeDefined();
    });

    it('locks the account second step after repeated failures and audits it', async () => {
      const { member, role } = await staffAccount();
      const first = await login(member);
      const pending = pendingOf(member, role, first.session.id);
      for (let i = 0; i < 5; i++)
        await staff.verifyEmailCode(pending, { code: '123456' }, h.meta).catch(() => undefined);
      await expect(
        staff.verifyEmailCode(pending, { code: h.codeFor(member.email) }, h.meta),
      ).rejects.toBeInstanceOf(RateLimited);
    });
  });

  describe('resend', () => {
    it('a second password sign in within a minute reuses the mailed code instead of failing', async () => {
      const { member } = await staffAccount();
      const first = await login(member);
      const mails = h.mailsTo(member.email);
      const second = await login(member);
      expect(second.status).toBe('email_code_required');
      expect(second.codeSent).toBe(true);
      expect(h.mailsTo(member.email)).toBe(mails);
      await staff.verifyEmailCode(
        pendingOf(member, 'editor', second.session.id),
        { code: h.codeFor(member.email) },
        h.meta,
      );
      expect(first.session.id).not.toBe(second.session.id);
    });

    it('waits 60 seconds, then voids the old code', async () => {
      const { member, role } = await staffAccount();
      const first = await login(member);
      const pending = pendingOf(member, role, first.session.id);
      const oldCode = h.codeFor(member.email);
      await expect(staff.sendSignInCode(pending, h.meta)).rejects.toBeInstanceOf(RateLimited);
      h.advance(61);
      await staff.sendSignInCode(pending, h.meta);
      const fresh = h.codeFor(member.email);
      if (fresh !== oldCode)
        await expect(
          staff.verifyEmailCode(pending, { code: oldCode }, h.meta),
        ).rejects.toBeInstanceOf(FieldErrors);
      await expect(
        staff.verifyEmailCode(pending, { code: fresh }, h.meta),
      ).resolves.toBeDefined();
    });

    it('reports how long to wait', async () => {
      const { member, role } = await staffAccount();
      const first = await login(member);
      h.advance(20);
      const error = await staff
        .sendSignInCode(pendingOf(member, role, first.session.id), h.meta)
        .catch((e: unknown) => e);
      expect(error).toBeInstanceOf(RateLimited);
      expect((error as RateLimited).retryAfterSeconds).toBe(40);
    });

    it('caps sends at 5 an hour', async () => {
      const { member, role } = await staffAccount();
      const first = await login(member);
      const pending = pendingOf(member, role, first.session.id);
      for (let i = 0; i < 4; i++) {
        h.advance(61);
        await staff.sendSignInCode(pending, h.meta);
      }
      h.advance(61);
      await expect(staff.sendSignInCode(pending, h.meta)).rejects.toBeInstanceOf(RateLimited);
    });

    it('is refused for a session that already passed the second step', async () => {
      const s = await signedIn();
      await expect(staff.sendSignInCode(s.actor, h.meta)).rejects.toBeInstanceOf(Forbidden);
    });
  });

  describe('who gets which second step', () => {
    it('keeps an enrolled authenticator in charge and sends no email code', async () => {
      policy = 'authenticator';
      const { member, role } = await staffAccount();
      const first = await login(member);
      const pending = pendingOf(member, role, first.session.id);
      const enrol = await staff.beginEnrolment(pending, h.meta);
      h.advance(31);
      await staff.confirmEnrolment(
        pending,
        { code: totpAt(base32Decode(enrol.secret), h.deps.clock!().getTime()) },
        h.meta,
      );
      policy = 'email';
      const mails = h.mailsTo(member.email);
      const again = await login(member);
      expect(again.status).toBe('mfa_required');
      expect(h.mailsTo(member.email)).toBe(mails);
      await expect(
        staff.verifyEmailCode(pendingOf(member, role, again.session.id), { code: '123456' }, h.meta),
      ).rejects.toBeInstanceOf(Forbidden);
    });

    it('asks for an authenticator when the site setting says authenticator', async () => {
      policy = 'authenticator';
      const { member } = await staffAccount();
      const before = h.mailsTo(member.email);
      expect((await login(member)).status).toBe('enrol_required');
      expect(h.mailsTo(member.email)).toBe(before);
      policy = 'email';
    });

    it('falls back to the authenticator when mail cannot be sent, never to no second step', async () => {
      emailUp = false;
      const { member } = await staffAccount();
      expect((await login(member)).status).toBe('enrol_required');
      emailUp = true;
    });

    it('a password only session cannot enrol an authenticator while email is the second step', async () => {
      const { member, role } = await staffAccount();
      const first = await login(member);
      await expect(
        staff.beginEnrolment(pendingOf(member, role, first.session.id), h.meta),
      ).rejects.toBeInstanceOf(Forbidden);
    });

    it('a signed in member can choose an authenticator and is then asked for it', async () => {
      const s = await signedIn();
      const enrol = await staff.beginEnrolment(s.actor, h.meta);
      h.advance(31);
      await staff.confirmEnrolment(
        s.actor,
        { code: totpAt(base32Decode(enrol.secret), h.deps.clock!().getTime()) },
        h.meta,
      );
      expect((await login(s.member)).status).toBe('mfa_required');
    });

    it('a new invitee sets a password and signs in with the emailed code, no enrolment', async () => {
      const boss = await signedIn('super_admin');
      await staff.reauthenticate(boss.actor, boss.member.password, h.meta);
      const email = address();
      await staff.createInvite(boss.actor, { email, role: 'editor' }, h.meta);
      const accepted = await staff.acceptInvite(
        { token: h.tokenFor(email), password: TEST_PASSWORD },
        h.meta,
      );
      expect(accepted.status).toBe('email_code_required');
      const done = await staff.verifyEmailCode(
        { accountId: accepted.accountId, role: 'editor', sessionId: accepted.session.id },
        { code: h.codeFor(email) },
        h.meta,
      );
      expect(await h.deps.sessions.validate(done.session.token)).toMatchObject({
        mfaVerified: true,
      });
    });
  });

  describe('sensitive actions accept a fresh email code', () => {
    it('changes the password with a mailed confirm code', async () => {
      const s = await signedIn();
      await staff.sendConfirmCode(s.actor, h.meta);
      const code = h.codeFor(s.member.email);
      const result = await staff.changeStaffPassword(
        s.actor,
        { currentPassword: s.member.password, newPassword: 'amber-harbour-77-plum', code },
        h.meta,
      );
      expect(result.session.token).toBeTruthy();
    });

    it('refuses a wrong or sign in code for a sensitive action', async () => {
      const s = await signedIn();
      await staff.sendConfirmCode(s.actor, h.meta);
      await expect(
        staff.changeStaffPassword(
          s.actor,
          { currentPassword: s.member.password, newPassword: 'amber-harbour-77-plum', code: '000000' },
          h.meta,
        ),
      ).rejects.toBeInstanceOf(FieldErrors);
    });

    it('reauthenticates for roles and invites with an email code instead of the password', async () => {
      const boss = await signedIn('super_admin');
      h.advance(11 * 60);
      await expect(
        staff.createInvite(boss.actor, { email: address(), role: 'editor' }, h.meta),
      ).rejects.toBeInstanceOf(ReauthRequired);
      await staff.sendConfirmCode(boss.actor, h.meta);
      await staff.reauthenticateWithEmailCode(
        boss.actor,
        { code: h.codeFor(boss.member.email) },
        h.meta,
      );
      await expect(
        staff.createInvite(boss.actor, { email: address(), role: 'editor' }, h.meta),
      ).resolves.toBeDefined();
    });

    it('lets a Super admin without an authenticator reset a colleague with an email code', async () => {
      const boss = await signedIn('super_admin');
      const other = await signedIn('editor');
      await staff.sendConfirmCode(boss.actor, h.meta);
      await expect(
        staff.resetTwoFactor(
          boss.actor,
          { accountId: other.member.id, code: h.codeFor(boss.member.email) },
          h.meta,
        ),
      ).resolves.toBeUndefined();
    });

    it('has no recovery codes without an authenticator and says so', async () => {
      const s = await signedIn();
      await staff.sendConfirmCode(s.actor, h.meta);
      await expect(
        staff.regenerateRecoveryCodes(s.actor, { code: h.codeFor(s.member.email) }, h.meta),
      ).rejects.toBeInstanceOf(Conflict);
    });

    it('does not accept an email code for someone who has an authenticator', async () => {
      const s = await signedIn();
      const enrol = await staff.beginEnrolment(s.actor, h.meta);
      h.advance(31);
      const done = await staff.confirmEnrolment(
        s.actor,
        { code: totpAt(base32Decode(enrol.secret), h.deps.clock!().getTime()) },
        h.meta,
      );
      const context = await h.deps.sessions.validate(done.session.token);
      const actor = { ...s.actor, sessionId: context!.sessionId };
      await expect(staff.sendConfirmCode(actor, h.meta)).rejects.toBeInstanceOf(Conflict);
    });
  });

  describe('switching an authenticator account to email codes', () => {
    async function enrolled() {
      const s = await signedIn();
      const enrol = await staff.beginEnrolment(s.actor, h.meta);
      h.advance(31);
      const secret = enrol.secret;
      const done = await staff.confirmEnrolment(
        s.actor,
        { code: totpAt(base32Decode(secret), h.deps.clock!().getTime()) },
        h.meta,
      );
      const context = await h.deps.sessions.validate(done.session.token);
      return {
        ...s,
        secret,
        actor: { ...s.actor, sessionId: context!.sessionId },
      };
    }

    it('needs the current authenticator code, then email codes take over', async () => {
      const s = await enrolled();
      await expect(
        staff.switchToEmailCodes(s.actor, { code: '000000' }, h.meta),
      ).rejects.toBeInstanceOf(FieldErrors);
      h.advance(31);
      await staff.switchToEmailCodes(
        s.actor,
        { code: totpAt(base32Decode(s.secret), h.deps.clock!().getTime()) },
        h.meta,
      );
      expect((await login(s.member)).status).toBe('email_code_required');
    });

    it('is refused when the site wants authenticators or mail is off, so nobody is left without a step', async () => {
      const s = await enrolled();
      h.advance(31);
      const code = () => totpAt(base32Decode(s.secret), h.deps.clock!().getTime());
      policy = 'authenticator';
      await expect(staff.switchToEmailCodes(s.actor, { code: code() }, h.meta)).rejects.toBeInstanceOf(
        Conflict,
      );
      policy = 'email';
      emailUp = false;
      await expect(staff.switchToEmailCodes(s.actor, { code: code() }, h.meta)).rejects.toBeInstanceOf(
        Conflict,
      );
      emailUp = true;
      expect((await login(s.member)).status).toBe('mfa_required');
    });
  });

  describe('recovery by email', () => {
    it('a staff password reset ends sessions, signs nobody in and still needs a code', async () => {
      const s = await signedIn();
      await staff.requestPasswordReset({ email: s.member.email }, h.meta);
      await h.settle();
      const token = h.tokenFor(s.member.email);
      const result = await staff.resetPassword({ token, password: 'copper-valley-88-fig' }, h.meta);
      expect(result).toBeUndefined();
      expect(await h.deps.sessions.validate(s.token)).toBeNull();
      const next = await staff.adminSignIn(
        { email: s.member.email, password: 'copper-valley-88-fig' },
        h.meta,
      );
      expect(next.status).toBe('email_code_required');
    });

    it('an email change sends a notice to the old address', async () => {
      const s = await signedIn();
      const before = h.mailsTo(s.member.email);
      await staff.requestEmailChange(
        s.actor,
        { newEmail: address(), password: s.member.password },
        h.meta,
      );
      await h.settle();
      expect(h.mailsTo(s.member.email)).toBe(before + 1);
    });
  });
});
