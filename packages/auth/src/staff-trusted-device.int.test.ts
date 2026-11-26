import { schema } from '@ad/db';
import { integrationEnabled } from '@ad/db/testing';
import { SessionService } from './sessions';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { StaffService } from './staff';
import { createAuthHarness, registerMember, type AuthHarness, type TestMember } from './testing';

describe.skipIf(!integrationEnabled())('remembered staff devices and staff session lifetimes (D-397)', () => {
  let h: AuthHarness;
  let staff: StaffService;
  let days = 30;
  let idleDays = 7;
  let absoluteDays = 30;

  beforeAll(async () => {
    h = await createAuthHarness({
      secondStepPolicy: async () => 'email',
      trustedDeviceDays: async () => days,
    });
    h.deps.sessions = new SessionService(h.dbs.app.db, {
      clock: h.deps.clock,
      staffPolicy: async () => ({
        idleSeconds: idleDays * 86400,
        absoluteSeconds: absoluteDays * 86400,
      }),
    });
    staff = new StaffService(h.deps);
  });
  afterAll(async () => {
    await h.drop();
  });

  async function account(role: 'editor' | 'super_admin' = 'editor') {
    const member = await registerMember(h, staff);
    await h.dbs.admin.db
      .update(schema.accounts)
      .set({ role })
      .where(eq(schema.accounts.id, member.id));
    return { member, role };
  }
  const login = (member: TestMember, token?: string) =>
    staff.adminSignIn(
      { email: member.email, password: member.password },
      { ...h.meta, trustedDeviceToken: token ?? null },
    );
  /** Signs in with the emailed code, optionally remembering the device. */
  async function codeSignIn(member: TestMember, role: 'editor' | 'super_admin', remember: boolean) {
    const first = await login(member);
    return staff.verifyEmailCode(
      { accountId: member.id, role, sessionId: first.session.id },
      { code: h.codeFor(member.email), remember },
      h.meta,
    );
  }

  describe('remember this device', () => {
    it('hands back a token only when asked and keeps just its hash', async () => {
      const { member, role } = await account();
      const without = await codeSignIn(member, role, false);
      expect(without.trustedDevice).toBeUndefined();
      const done = await codeSignIn(member, role, true);
      expect(done.trustedDevice?.maxAgeSeconds).toBe(30 * 86400);
      const rows = await h.dbs.admin.db
        .select()
        .from(schema.trustedDevices)
        .where(eq(schema.trustedDevices.accountId, member.id));
      expect(rows).toHaveLength(1);
      expect(Buffer.from(rows[0]!.tokenHash).toString('utf8')).not.toContain(done.trustedDevice!.token);
    });

    it('skips the emailed code on a known device and audits it', async () => {
      const { member, role } = await account();
      const token = (await codeSignIn(member, role, true)).trustedDevice!.token;
      const mails = h.mailsTo(member.email);
      const again = await login(member, token);
      expect(again.status).toBe('signed_in');
      expect(h.mailsTo(member.email)).toBe(mails);
      expect(await h.deps.sessions.validate(again.session.token)).toMatchObject({
        mfaVerified: true,
      });
      const audit = await h.dbs.admin.db.select().from(schema.auditLog);
      expect(audit.some((r) => JSON.stringify(r.metadata).includes('trusted_device'))).toBe(true);
    });

    it('still asks for the code with a wrong token, or a token made for another account', async () => {
      const a = await account();
      const b = await account();
      const tokenA = (await codeSignIn(a.member, a.role, true)).trustedDevice!.token;
      expect((await login(a.member, 'not-a-real-token')).status).toBe('email_code_required');
      expect((await login(b.member, tokenA)).status).toBe('email_code_required');
    });

    it('expires after the configured days', async () => {
      const { member, role } = await account();
      const token = (await codeSignIn(member, role, true)).trustedDevice!.token;
      h.advance(30 * 86400 + 5);
      expect((await login(member, token)).status).toBe('email_code_required');
    });

    it('is off when the setting is 0 days', async () => {
      days = 0;
      const { member, role } = await account();
      const done = await codeSignIn(member, role, true);
      expect(done.trustedDevice).toBeUndefined();
      days = 30;
    });

    it('lists the device and a revoke makes the next sign in ask for the code', async () => {
      const { member, role } = await account();
      const token = (await codeSignIn(member, role, true)).trustedDevice!.token;
      const full = await login(member, token);
      const context = await h.deps.sessions.validate(full.session.token);
      const actor = { accountId: member.id, role, sessionId: context!.sessionId };
      const devices = await staff.listTrustedDevices(actor);
      expect(devices).toHaveLength(1);
      expect(devices[0]!.label).toBeTruthy();
      await staff.revokeTrustedDevice(actor, devices[0]!.id, h.meta);
      expect(await staff.listTrustedDevices(actor)).toHaveLength(0);
      expect((await login(member, token)).status).toBe('email_code_required');
    });

    it('is cleared by sign out everywhere, a password change and a role change', async () => {
      const boss = await account('super_admin');
      const bossToken = (await codeSignIn(boss.member, boss.role, true)).trustedDevice!.token;
      const bossSession = await login(boss.member, bossToken);
      const bossContext = await h.deps.sessions.validate(bossSession.session.token);
      const bossActor = { accountId: boss.member.id, role: boss.role, sessionId: bossContext!.sessionId };

      await staff.signOutEverywhere(bossActor, boss.member.password, h.meta);
      expect((await login(boss.member, bossToken)).status).toBe('email_code_required');

      const other = await account();
      const otherToken = (await codeSignIn(other.member, other.role, true)).trustedDevice!.token;
      const otherSession = await login(other.member, otherToken);
      const otherContext = await h.deps.sessions.validate(otherSession.session.token);
      const otherActor = {
        accountId: other.member.id,
        role: other.role,
        sessionId: otherContext!.sessionId,
      };
      await staff.sendConfirmCode(otherActor, h.meta);
      await staff.changeStaffPassword(
        otherActor,
        {
          currentPassword: other.member.password,
          newPassword: 'amber-harbour-77-plum',
          code: h.codeFor(other.member.email),
        },
        h.meta,
      );
      const changed = await staff.adminSignIn(
        { email: other.member.email, password: 'amber-harbour-77-plum' },
        { ...h.meta, trustedDeviceToken: otherToken },
      );
      expect(changed.status).toBe('email_code_required');

      const third = await account();
      const thirdToken = (await codeSignIn(third.member, third.role, true)).trustedDevice!.token;
      const boss2 = await codeSignIn(boss.member, boss.role, false);
      const boss2Context = await h.deps.sessions.validate(boss2.session.token);
      await staff.changeRole(
        { accountId: boss.member.id, role: boss.role, sessionId: boss2Context!.sessionId },
        { accountId: third.member.id, role: 'admin', expectedRole: 'editor' },
        h.meta,
      );
      expect((await login(third.member, thirdToken)).status).toBe('email_code_required');
    });
  });

  describe('staff session lifetime', () => {
    it('defaults to 7 days idle and 30 days absolute for a staff session', async () => {
      const { member, role } = await account();
      const done = await codeSignIn(member, role, false);
      const context = await h.deps.sessions.validate(done.session.token);
      const now = h.deps.clock!().getTime();
      expect(context!.absoluteExpiresAt.getTime() - now).toBe(30 * 86400 * 1000);
      expect(context!.idleExpiresAt.getTime() - now).toBe(7 * 86400 * 1000);
    });

    it('slides the idle window with activity and ends at the absolute limit', async () => {
      const { member, role } = await account();
      const done = await codeSignIn(member, role, false);
      h.advance(6 * 86400);
      const touched = await h.deps.sessions.validate(done.session.token);
      expect(touched).not.toBeNull();
      h.advance(6 * 86400);
      expect(await h.deps.sessions.validate(done.session.token)).not.toBeNull();
      h.advance(20 * 86400);
      expect(await h.deps.sessions.validate(done.session.token)).toBeNull();
    });

    it('follows the site settings', async () => {
      idleDays = 2;
      absoluteDays = 3;
      const { member, role } = await account();
      const done = await codeSignIn(member, role, false);
      const context = await h.deps.sessions.validate(done.session.token);
      const now = h.deps.clock!().getTime();
      expect(context!.idleExpiresAt.getTime() - now).toBe(2 * 86400 * 1000);
      expect(context!.absoluteExpiresAt.getTime() - now).toBe(3 * 86400 * 1000);
      idleDays = 7;
      absoluteDays = 30;
    });
  });
});
