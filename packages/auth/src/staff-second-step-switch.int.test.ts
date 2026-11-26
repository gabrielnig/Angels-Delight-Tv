import { schema } from '@ad/db';
import { integrationEnabled } from '@ad/db/testing';
import { Conflict, Forbidden } from '@ad/shared';
import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { StaffService } from './staff';
import { base32Decode, totpAt } from './totp';
import { createAuthHarness, registerMember, type AuthHarness } from './testing';
import { FieldErrors } from './types';

describe.skipIf(!integrationEnabled())('staff second step switch from My account (L16b)', () => {
  let h: AuthHarness;
  let staff: StaffService;
  let policy: 'email' | 'authenticator' = 'email';
  let emailUp = true;

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

  const totp = (secret: string) => totpAt(base32Decode(secret), h.deps.clock!().getTime());

  /** A Super admin with a confirmed authenticator, signed in on a full session. */
  async function withAuthenticator() {
    const member = await registerMember(h, staff);
    await h.dbs.admin.db
      .update(schema.accounts)
      .set({ role: 'super_admin' })
      .where(eq(schema.accounts.id, member.id));
    const first = await staff.adminSignIn({ email: member.email, password: member.password }, h.meta);
    const pending = { accountId: member.id, role: 'super_admin' as const, sessionId: first.session.id };
    const done = await staff.verifyEmailCode(pending, { code: h.codeFor(member.email) }, h.meta);
    const context = await h.deps.sessions.validate(done.session.token);
    let actor = { accountId: member.id, role: 'super_admin' as const, sessionId: context!.sessionId };
    const enrol = await staff.beginEnrolment(actor, h.meta);
    h.advance(31);
    const confirmed = await staff.confirmEnrolment(actor, { code: totp(enrol.secret) }, h.meta);
    const ctx2 = await h.deps.sessions.validate(confirmed.session.token);
    actor = { ...actor, sessionId: ctx2!.sessionId };
    await staff.assertRecentReauth(actor);
    return { member, actor, secret: enrol.secret };
  }

  async function audits(accountId: string, action: string) {
    return h.dbs.admin.db
      .select()
      .from(schema.auditLog)
      .where(and(eq(schema.auditLog.actorAccountId, accountId), eq(schema.auditLog.action, action)));
  }

  async function testCode(s: Awaited<ReturnType<typeof withAuthenticator>>) {
    h.advance(61);
    await staff.sendTestCode(s.actor, h.meta);
    await staff.confirmTestCode(s.actor, { code: h.codeFor(s.member.email) }, h.meta);
  }

  describe('summary and guards', () => {
    it('reports the method and what blocks the switch', async () => {
      const s = await withAuthenticator();
      expect(await staff.securitySummary(s.actor)).toMatchObject({
        method: 'authenticator',
        canUseEmail: true,
        testedRecently: false,
      });
      emailUp = false;
      const off = await staff.securitySummary(s.actor);
      expect(off.canUseEmail).toBe(false);
      expect(off.blocker).toMatch(/email/i);
      emailUp = true;
      policy = 'authenticator';
      expect((await staff.securitySummary(s.actor)).blocker).toMatch(/Site settings/);
      policy = 'email';
      await h.dbs.admin.db
        .update(schema.accounts)
        .set({ emailVerifiedAt: null })
        .where(eq(schema.accounts.id, s.member.id));
      expect((await staff.securitySummary(s.actor)).blocker).toMatch(/verif/i);
    });

    it('refuses a test code when mail is off or the address is unverified', async () => {
      const s = await withAuthenticator();
      emailUp = false;
      h.advance(61);
      await expect(staff.sendTestCode(s.actor, h.meta)).rejects.toBeInstanceOf(Conflict);
      emailUp = true;
    });
  });

  describe('switch to emailed codes', () => {
    it('refuses the password path until a test code worked', async () => {
      const s = await withAuthenticator();
      h.advance(31);
      await expect(
        staff.switchToEmailCodes(s.actor, { password: s.member.password, code: totp(s.secret) }, h.meta),
      ).rejects.toBeInstanceOf(Conflict);
      expect((await staff.securitySummary(s.actor)).method).toBe('authenticator');
    });

    it('a wrong test code does not count as a test', async () => {
      const s = await withAuthenticator();
      h.advance(61);
      await staff.sendTestCode(s.actor, h.meta);
      await expect(staff.confirmTestCode(s.actor, { code: '000000' }, h.meta)).rejects.toBeInstanceOf(FieldErrors);
      expect((await staff.securitySummary(s.actor)).testedRecently).toBe(false);
    });

    it('switches with a fresh password, the current authenticator code and a working test', async () => {
      const s = await withAuthenticator();
      await testCode(s);
      expect((await staff.securitySummary(s.actor)).testedRecently).toBe(true);
      h.advance(31);
      const mails = h.mailsTo(s.member.email);
      await staff.switchToEmailCodes(s.actor, { password: s.member.password, code: totp(s.secret) }, h.meta);
      await h.settle();
      const summary = await staff.securitySummary(s.actor);
      expect(summary.method).toBe('email');
      const [factors, recovery] = await Promise.all([
        h.dbs.admin.db.select().from(schema.mfaFactors).where(eq(schema.mfaFactors.accountId, s.member.id)),
        h.dbs.admin.db.select().from(schema.mfaRecoveryCodes).where(eq(schema.mfaRecoveryCodes.accountId, s.member.id)),
      ]);
      expect(factors).toHaveLength(0);
      expect(recovery).toHaveLength(0);
      expect((await audits(s.member.id, 'admin.mfa_switched_to_email')).length).toBe(1);
      expect((await audits(s.member.id, 'admin.email_code_tested')).length).toBeGreaterThan(0);
      expect(h.mailsTo(s.member.email)).toBeGreaterThan(mails);
      const notice = h.transport.outbox.filter((m) => m.to === s.member.email).at(-1)!;
      expect(notice.text).toMatch(/emailed code/i);
      expect(notice.text).toContain('/forgot-password');
      const next = await staff.adminSignIn({ email: s.member.email, password: s.member.password }, h.meta);
      expect(next.status).toBe('email_code_required');
    });

    it('a wrong password or a wrong authenticator code changes nothing', async () => {
      const s = await withAuthenticator();
      await testCode(s);
      h.advance(31);
      await expect(
        staff.switchToEmailCodes(s.actor, { password: 'not-the-password-1', code: totp(s.secret) }, h.meta),
      ).rejects.toBeDefined();
      await expect(
        staff.switchToEmailCodes(s.actor, { password: s.member.password, code: '000000' }, h.meta),
      ).rejects.toBeInstanceOf(FieldErrors);
      expect((await staff.securitySummary(s.actor)).method).toBe('authenticator');
    });

    it('a fresh emailed code is enough on its own and counts as the test', async () => {
      const s = await withAuthenticator();
      h.advance(61);
      await staff.sendTestCode(s.actor, h.meta);
      await staff.switchToEmailCodes(s.actor, { emailCode: h.codeFor(s.member.email) }, h.meta);
      expect((await staff.securitySummary(s.actor)).method).toBe('email');
      expect((await audits(s.member.id, 'admin.mfa_switched_to_email'))[0]?.metadata).toMatchObject({
        proof: 'email_code',
      });
    });

    it('is refused when mail is off, the site wants authenticators, or the address is unverified', async () => {
      const s = await withAuthenticator();
      await testCode(s);
      h.advance(31);
      const input = () => ({ password: s.member.password, code: totp(s.secret) });
      emailUp = false;
      await expect(staff.switchToEmailCodes(s.actor, input(), h.meta)).rejects.toBeInstanceOf(Conflict);
      emailUp = true;
      policy = 'authenticator';
      await expect(staff.switchToEmailCodes(s.actor, input(), h.meta)).rejects.toBeInstanceOf(Conflict);
      policy = 'email';
      await h.dbs.admin.db
        .update(schema.accounts)
        .set({ emailVerifiedAt: null })
        .where(eq(schema.accounts.id, s.member.id));
      await expect(staff.switchToEmailCodes(s.actor, input(), h.meta)).rejects.toBeInstanceOf(Conflict);
      await h.dbs.admin.db
        .update(schema.accounts)
        .set({ emailVerifiedAt: new Date() })
        .where(eq(schema.accounts.id, s.member.id));
      expect((await staff.securitySummary(s.actor)).method).toBe('authenticator');
    });

    it('is refused for a session still waiting for its second step', async () => {
      const s = await withAuthenticator();
      const first = await staff.adminSignIn({ email: s.member.email, password: s.member.password }, h.meta);
      const pending = { accountId: s.member.id, role: 'super_admin' as const, sessionId: first.session.id };
      await expect(staff.sendTestCode(pending, h.meta)).rejects.toBeInstanceOf(Forbidden);
    });
  });

  describe('switch back to an authenticator', () => {
    async function onEmail() {
      const s = await withAuthenticator();
      h.advance(61);
      await staff.sendTestCode(s.actor, h.meta);
      await staff.switchToEmailCodes(s.actor, { emailCode: h.codeFor(s.member.email) }, h.meta);
      return s;
    }

    it('needs the password, then a code from the new app, and returns recovery codes', async () => {
      const s = await onEmail();
      await expect(
        staff.beginAuthenticatorSwitch(s.actor, { password: 'not-the-password-1' }, h.meta),
      ).rejects.toBeDefined();
      const begin = await staff.beginAuthenticatorSwitch(s.actor, { password: s.member.password }, h.meta);
      expect(begin.secret).toMatch(/^[A-Z2-7]+$/);
      h.advance(31);
      await expect(staff.finishAuthenticatorSwitch(s.actor, { code: '000000' }, h.meta)).rejects.toBeInstanceOf(
        FieldErrors,
      );
      const done = await staff.finishAuthenticatorSwitch(s.actor, { code: totp(begin.secret) }, h.meta);
      await h.settle();
      expect(done.recoveryCodes.length).toBeGreaterThan(0);
      expect((await staff.securitySummary(s.actor)).method).toBe('authenticator');
      expect((await audits(s.member.id, 'admin.mfa_switched_to_authenticator')).length).toBe(1);
      const notice = h.transport.outbox.filter((m) => m.to === s.member.email).at(-1)!;
      expect(notice.text).toMatch(/authenticator app/i);
      const next = await staff.adminSignIn({ email: s.member.email, password: s.member.password }, h.meta);
      expect(next.status).toBe('mfa_required');
    });

    it('is refused when the account already has an authenticator', async () => {
      const s = await withAuthenticator();
      await expect(
        staff.beginAuthenticatorSwitch(s.actor, { password: s.member.password }, h.meta),
      ).rejects.toBeInstanceOf(Conflict);
    });
  });
});
