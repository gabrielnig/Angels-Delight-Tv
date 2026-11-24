import { schema } from '@ad/db';
import { integrationEnabled } from '@ad/db/testing';
import { RateLimited } from '@ad/shared';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { StaffService } from './staff';
import { base32Decode, totpAt } from './totp';
import { createAuthHarness, registerMember, type AuthHarness } from './testing';
import { FieldErrors } from './types';

/** Password and recovery paths for staff on real tables (M12-S01 AC3, M12-S02 AC3, M12-S09). */
describe.skipIf(!integrationEnabled())('staff password and recovery flows', () => {
  let h: AuthHarness;
  let staff: StaffService;

  beforeAll(async () => {
    h = await createAuthHarness();
    staff = new StaffService(h.deps);
  });
  afterAll(async () => {
    await h.drop();
  });

  const codeNow = (secret: string) => totpAt(base32Decode(secret), h.deps.clock!().getTime());

  async function staffMember(role: 'editor' | 'admin') {
    const member = await registerMember(h, staff);
    await h.dbs.admin.db
      .update(schema.accounts)
      .set({ role })
      .where(eq(schema.accounts.id, member.id));
    const login = await staff.adminSignIn(
      { email: member.email, password: member.password },
      h.meta,
    );
    const pending = { accountId: member.id, role, sessionId: login.session.id };
    const enrolment = await staff.beginEnrolment(pending, h.meta);
    h.advance(31);
    const done = await staff.confirmEnrolment(pending, { code: codeNow(enrolment.secret) }, h.meta);
    const context = await h.deps.sessions.validate(done.session.token);
    return {
      member,
      secret: enrolment.secret,
      recoveryCodes: done.recoveryCodes,
      token: done.session.token,
      actor: { accountId: member.id, role, sessionId: context!.sessionId },
    };
  }

  it('counts wrong current passwords on My account toward the admin lockout', async () => {
    const s = await staffMember('admin');
    for (let i = 0; i < 3; i += 1) {
      h.advance(31);
      await expect(
        staff.changeStaffPassword(
          s.actor,
          {
            currentPassword: 'not-the-password-1',
            newPassword: 'another-staff-secret-9',
            code: codeNow(s.secret),
          },
          h.meta,
        ),
      ).rejects.toBeInstanceOf(FieldErrors);
    }
    const locked = await staff
      .adminSignIn({ email: s.member.email, password: s.member.password }, h.meta)
      .catch((e: unknown) => e);
    expect(locked).toBeInstanceOf(RateLimited);
    expect((locked as RateLimited).retryAfterSeconds).toBeGreaterThan(1790);
    const audit = await h.dbs.admin.db
      .select()
      .from(schema.auditLog)
      .where(eq(schema.auditLog.actorAccountId, s.member.id));
    expect(audit.some((row) => row.action === 'admin.lockout')).toBe(true);
  });

  it('counts a wrong password at the confirmation prompt toward the same lockout', async () => {
    const s = await staffMember('admin');
    for (let i = 0; i < 3; i += 1)
      await staff.reauthenticate(s.actor, 'wrong-password-77', h.meta).catch(() => undefined);
    await expect(staff.reauthenticate(s.actor, s.member.password, h.meta)).rejects.toBeInstanceOf(
      RateLimited,
    );
  });

  it('lets a locked admin back in after the emailed password reset, and still asks for the second factor', async () => {
    const s = await staffMember('admin');
    for (let i = 0; i < 3; i += 1)
      await staff
        .adminSignIn({ email: s.member.email, password: 'wrong-password-12' }, h.meta)
        .catch(() => undefined);
    await expect(
      staff.adminSignIn({ email: s.member.email, password: s.member.password }, h.meta),
    ).rejects.toBeInstanceOf(RateLimited);

    await staff.requestPasswordReset({ email: s.member.email }, h.meta);
    await h.settle();
    await staff.resetPassword(
      { token: h.tokenFor(s.member.email), password: 'a-new-staff-secret-42' },
      h.meta,
    );

    expect(await h.deps.sessions.validate(s.token)).toBeNull();
    const login = await staff.adminSignIn(
      { email: s.member.email, password: 'a-new-staff-secret-42' },
      h.meta,
    );
    expect(login.status).toBe('mfa_required');
  });

  it('signs in with a recovery code after the password reset, once, and then crosses it off', async () => {
    const s = await staffMember('editor');
    await staff.requestPasswordReset({ email: s.member.email }, h.meta);
    await h.settle();
    await staff.resetPassword(
      { token: h.tokenFor(s.member.email), password: 'recover-staff-secret-8' },
      h.meta,
    );
    const login = await staff.adminSignIn(
      { email: s.member.email, password: 'recover-staff-secret-8' },
      h.meta,
    );
    const pending = {
      accountId: s.member.id,
      role: 'editor' as const,
      sessionId: login.session.id,
    };
    const code = s.recoveryCodes[0]!;
    const done = await staff.verifyRecoveryCode(pending, { code }, h.meta);
    expect((await h.deps.sessions.validate(done.session.token))?.mfaVerified).toBe(true);
    expect(done.remaining).toBe(9);
    const again = await staff.adminSignIn(
      { email: s.member.email, password: 'recover-staff-secret-8' },
      h.meta,
    );
    await expect(
      staff.verifyRecoveryCode(
        { accountId: s.member.id, role: 'editor', sessionId: again.session.id },
        { code },
        h.meta,
      ),
    ).rejects.toBeInstanceOf(FieldErrors);
  });
});
