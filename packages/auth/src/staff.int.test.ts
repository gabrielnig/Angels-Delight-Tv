import { schema, withAccount } from '@ad/db';
import { integrationEnabled } from '@ad/db/testing';
import { Conflict, Forbidden, RateLimited } from '@ad/shared';
import { eq, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { StaffService } from './staff';
import { base32Decode, totpAt } from './totp';
import {
  createAuthHarness,
  registerMember,
  signInActor,
  TEST_PASSWORD,
  type AuthHarness,
  type TestMember,
} from './testing';
import { FieldErrors, InvalidCredentials, ReauthRequired, TokenRejected } from './types';

describe.skipIf(!integrationEnabled())('staff sign in, two factor, invites and roles', () => {
  let h: AuthHarness;
  let staff: StaffService;
  let n = 0;
  const address = () => `staff${++n}@example.org`;

  beforeAll(async () => {
    h = await createAuthHarness();
    staff = new StaffService(h.deps);
  });
  afterAll(async () => {
    await h.drop();
  });

  const codeNow = (secret: string) => totpAt(base32Decode(secret), h.deps.clock!().getTime());

  /** A staff account that finished enrolment and holds a staff session. */
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

  const loginPending = async (member: TestMember, role: 'editor' | 'admin') => {
    const login = await staff.adminSignIn(
      { email: member.email, password: member.password },
      h.meta,
    );
    return { login, pending: { accountId: member.id, role, sessionId: login.session.id } };
  };

  describe('adminSignIn', () => {
    it('asks a new staff account to enrol and returns a pending session with no admin rights', async () => {
      const member = await registerMember(h, staff);
      await h.dbs.admin.db
        .update(schema.accounts)
        .set({ role: 'admin' })
        .where(eq(schema.accounts.id, member.id));
      const login = await staff.adminSignIn(
        { email: member.email, password: member.password },
        h.meta,
      );
      expect(login.status).toBe('enrol_required');
      const context = await h.deps.sessions.validate(login.session.token);
      expect(context).toMatchObject({ role: 'admin', mfaVerified: false });
    });

    it('asks an enrolled account for its code', async () => {
      const s = await staffMember('admin');
      const login = await staff.adminSignIn(
        { email: s.member.email, password: s.member.password },
        h.meta,
      );
      expect(login.status).toBe('mfa_required');
    });

    it('gives a viewer the generic error and creates no session', async () => {
      const viewer = await registerMember(h, staff);
      const before = await h.dbs.admin.db
        .select()
        .from(schema.sessions)
        .where(eq(schema.sessions.accountId, viewer.id));
      await expect(
        staff.adminSignIn({ email: viewer.email, password: viewer.password }, h.meta),
      ).rejects.toBeInstanceOf(InvalidCredentials);
      const after = await h.dbs.admin.db
        .select()
        .from(schema.sessions)
        .where(eq(schema.sessions.accountId, viewer.id));
      expect(after).toHaveLength(before.length);
    });

    it('gives the same error for a wrong password, an unknown address and a suspended admin', async () => {
      const s = await staffMember('editor');
      await expect(
        staff.adminSignIn({ email: s.member.email, password: 'wrong-password-12' }, h.meta),
      ).rejects.toBeInstanceOf(InvalidCredentials);
      await expect(
        staff.adminSignIn({ email: 'nobody@example.org', password: 'wrong-password-12' }, h.meta),
      ).rejects.toBeInstanceOf(InvalidCredentials);
      await h.dbs.admin.db
        .update(schema.accounts)
        .set({ status: 'suspended' })
        .where(eq(schema.accounts.id, s.member.id));
      await expect(
        staff.adminSignIn({ email: s.member.email, password: s.member.password }, h.meta),
      ).rejects.toBeInstanceOf(InvalidCredentials);
    });

    it('locks for 30 minutes after three failures and warns the admins by email', async () => {
      const boss = await staffMember('admin');
      const target = await staffMember('editor');
      const before = h.mailsTo(boss.member.email);
      for (let i = 0; i < 3; i++)
        await staff
          .adminSignIn({ email: target.member.email, password: 'wrong-password-12' }, h.meta)
          .catch(() => undefined);
      const error = await staff
        .adminSignIn({ email: target.member.email, password: target.member.password }, h.meta)
        .catch((e: unknown) => e);
      expect(error).toBeInstanceOf(RateLimited);
      expect((error as RateLimited).retryAfterSeconds).toBeGreaterThan(1790);
      await h.settle();
      expect(h.mailsTo(boss.member.email)).toBeGreaterThan(before);
      expect(
        h.transport.outbox.some(
          (m) => m.to === boss.member.email && /staff account/i.test(m.subject),
        ),
      ).toBe(true);
    });

    it('skips the second factor only when the development switch is on', async () => {
      const dev = new StaffService({ ...h.deps, config: { devSkipMfa: true } });
      const member = await registerMember(h, dev);
      await h.dbs.admin.db
        .update(schema.accounts)
        .set({ role: 'admin' })
        .where(eq(schema.accounts.id, member.id));
      const login = await dev.adminSignIn(
        { email: member.email, password: member.password },
        h.meta,
      );
      expect(login.status).toBe('signed_in');
      expect((await h.deps.sessions.validate(login.session.token))?.mfaVerified).toBe(true);
    });
  });

  describe('enrolment', () => {
    it('shows a qr code and manual key, stores the secret sealed, and finishes with ten recovery codes', async () => {
      const member = await registerMember(h, staff);
      await h.dbs.admin.db
        .update(schema.accounts)
        .set({ role: 'editor' })
        .where(eq(schema.accounts.id, member.id));
      const { pending } = await loginPending(member, 'editor');
      expect(await staff.twoFactorConfirmed(pending)).toBe(false);
      const begin = await staff.beginEnrolment(pending, h.meta);
      expect(begin.uri).toContain('otpauth://totp/');
      expect(begin.qrSvg.startsWith('<svg')).toBe(true);
      const [factor] = await h.dbs.admin.db
        .select()
        .from(schema.mfaFactors)
        .where(eq(schema.mfaFactors.accountId, member.id));
      expect(factor?.confirmedAt).toBeNull();
      expect(Buffer.from(factor!.secretEnc).includes(Buffer.from(begin.secret))).toBe(false);

      await expect(
        staff.confirmEnrolment(pending, { code: '000000' }, h.meta),
      ).rejects.toMatchObject({ fields: { code: 'That code is not right' } });
      const done = await staff.confirmEnrolment(pending, { code: codeNow(begin.secret) }, h.meta);
      expect(done.recoveryCodes).toHaveLength(10);
      expect((await h.deps.sessions.validate(done.session.token))?.mfaVerified).toBe(true);
      const [old] = await h.dbs.admin.db
        .select()
        .from(schema.sessions)
        .where(eq(schema.sessions.id, pending.sessionId));
      expect(old?.revokedAt).not.toBeNull();
      const stored = await h.dbs.admin.db
        .select()
        .from(schema.mfaRecoveryCodes)
        .where(eq(schema.mfaRecoveryCodes.accountId, member.id));
      expect(stored).toHaveLength(10);
      expect(await staff.twoFactorConfirmed(pending)).toBe(true);
      expect(JSON.stringify(stored)).not.toContain(done.recoveryCodes[0]);
    });

    it('lets a second begin replace an unconfirmed secret but refuses once confirmed', async () => {
      const member = await registerMember(h, staff);
      await h.dbs.admin.db
        .update(schema.accounts)
        .set({ role: 'admin' })
        .where(eq(schema.accounts.id, member.id));
      const { pending } = await loginPending(member, 'admin');
      const first = await staff.beginEnrolment(pending, h.meta);
      const second = await staff.beginEnrolment(pending, h.meta);
      expect(second.secret).not.toBe(first.secret);
      await staff.confirmEnrolment(pending, { code: codeNow(second.secret) }, h.meta);
      await expect(staff.beginEnrolment(pending, h.meta)).rejects.toBeInstanceOf(Conflict);
    });

    it('does not let a viewer enrol', async () => {
      const viewer = await registerMember(h, staff);
      const { actor } = await signInActor(h, staff, viewer);
      await expect(staff.beginEnrolment(actor, h.meta)).rejects.toBeInstanceOf(Forbidden);
    });
  });

  describe('second factor at sign in', () => {
    it('promotes the pending session on the right code and refuses the same code again', async () => {
      const s = await staffMember('admin');
      h.advance(31);
      const { login, pending } = await loginPending(s.member, 'admin');
      const code = codeNow(s.secret);
      const ok = await staff.verifyMfa(pending, { code }, h.meta);
      expect((await h.deps.sessions.validate(ok.session.token))?.mfaVerified).toBe(true);
      expect(await h.deps.sessions.validate(login.session.token)).toBeNull();
      const again = await loginPending(s.member, 'admin');
      await expect(staff.verifyMfa(again.pending, { code }, h.meta)).rejects.toBeInstanceOf(
        FieldErrors,
      );
    });

    it('locks for fifteen minutes after five wrong codes', async () => {
      const s = await staffMember('editor');
      h.advance(31);
      const { pending } = await loginPending(s.member, 'editor');
      for (let i = 0; i < 5; i++)
        await staff.verifyMfa(pending, { code: '000000' }, h.meta).catch(() => undefined);
      await expect(
        staff.verifyMfa(pending, { code: codeNow(s.secret) }, h.meta),
      ).rejects.toBeInstanceOf(RateLimited);
    });

    it('accepts a recovery code once and then crosses it off', async () => {
      const s = await staffMember('editor');
      const code = s.recoveryCodes[0]!;
      const first = await loginPending(s.member, 'editor');
      const ok = await staff.verifyRecoveryCode(
        first.pending,
        { code: code.toUpperCase() },
        h.meta,
      );
      expect(ok.remaining).toBe(9);
      expect((await h.deps.sessions.validate(ok.session.token))?.mfaVerified).toBe(true);
      const second = await loginPending(s.member, 'editor');
      await expect(
        staff.verifyRecoveryCode(second.pending, { code }, h.meta),
      ).rejects.toBeInstanceOf(FieldErrors);
    });

    it('records login and second factor outcomes in the audit log', async () => {
      const rows = await h.dbs.admin.db.select().from(schema.auditLog);
      const actions = new Set(rows.map((r) => r.action));
      for (const action of ['admin.login', 'admin.mfa_enrolled', 'admin.mfa_failed'])
        expect(actions.has(action)).toBe(true);
    });
  });

  describe('invites', () => {
    it('lets an admin invite someone, stores the address sealed and mails a 72 hour link', async () => {
      const boss = await staffMember('admin');
      const email = address();
      const invite = await staff.createInvite(boss.actor, { email, role: 'editor' }, h.meta);
      expect(h.tokenFor(email)).toBeTruthy();
      expect(h.transport.outbox.at(-1)?.text).toContain('72 hours');
      const [row] = await h.dbs.admin.db
        .select()
        .from(schema.adminInvites)
        .where(eq(schema.adminInvites.id, invite.id));
      expect(Buffer.from(row!.emailEnc).includes(Buffer.from(email))).toBe(false);
      expect((await staff.listInvites(boss.actor)).map((i) => i.email)).toContain(email);
    });

    it('is for admins only and needs a recent password confirmation', async () => {
      const editor = await staffMember('editor');
      await expect(
        staff.createInvite(editor.actor, { email: address(), role: 'editor' }, h.meta),
      ).rejects.toBeInstanceOf(Forbidden);
      const boss = await staffMember('admin');
      h.advance(11 * 60);
      await expect(
        staff.createInvite(boss.actor, { email: address(), role: 'editor' }, h.meta),
      ).rejects.toBeInstanceOf(ReauthRequired);
      await staff.reauthenticate(boss.actor, boss.member.password, h.meta);
      await expect(
        staff.createInvite(boss.actor, { email: address(), role: 'editor' }, h.meta),
      ).resolves.toBeDefined();
    });

    it('a new person sets a password, gets the role, and must enrol before reaching admin', async () => {
      const boss = await staffMember('admin');
      const email = address();
      await staff.createInvite(boss.actor, { email, role: 'editor' }, h.meta);
      const token = h.tokenFor(email);
      expect(await staff.inspectInvite(token)).toEqual({ role: 'editor', existingAccount: false });
      await expect(staff.acceptInvite({ token, password: 'short' }, h.meta)).rejects.toBeInstanceOf(
        FieldErrors,
      );
      const accepted = await staff.acceptInvite({ token, password: TEST_PASSWORD }, h.meta);
      expect(accepted.status).toBe('enrol_required');
      expect(await h.deps.sessions.validate(accepted.session.token)).toMatchObject({
        role: 'editor',
        mfaVerified: false,
        emailVerified: true,
      });
      await expect(
        staff.acceptInvite({ token, password: TEST_PASSWORD }, h.meta),
      ).rejects.toMatchObject({ problem: 'used' });
      expect(await staff.listInvites(boss.actor)).not.toContainEqual(
        expect.objectContaining({ email }),
      );
    });

    it('grants the role on an existing viewer account after they confirm with their password', async () => {
      const boss = await staffMember('admin');
      const viewer = await registerMember(h, staff);
      const live = await signInActor(h, staff, viewer);
      await staff.createInvite(boss.actor, { email: viewer.email, role: 'editor' }, h.meta);
      const token = h.tokenFor(viewer.email);
      expect(await staff.inspectInvite(token)).toEqual({ role: 'editor', existingAccount: true });
      await expect(
        staff.acceptInvite({ token, password: 'wrong-password-12' }, h.meta),
      ).rejects.toBeInstanceOf(FieldErrors);
      const accepted = await staff.acceptInvite({ token, password: viewer.password }, h.meta);
      expect((await h.deps.sessions.validate(accepted.session.token))?.role).toBe('editor');
      expect(await h.deps.sessions.validate(live.session.token)).toBeNull();
      expect(
        (
          await h.dbs.admin.db
            .select()
            .from(schema.accounts)
            .where(eq(schema.accounts.id, viewer.id))
        )[0]?.role,
      ).toBe('editor');
    });

    it('rejects an expired, revoked or made up invite', async () => {
      const boss = await staffMember('admin');
      const lapsed = address();
      await staff.createInvite(boss.actor, { email: lapsed, role: 'editor' }, h.meta);
      const lapsedToken = h.tokenFor(lapsed);
      const revoked = address();
      const created = await staff.createInvite(
        boss.actor,
        { email: revoked, role: 'editor' },
        h.meta,
      );
      const revokedToken = h.tokenFor(revoked);
      await staff.revokeInvite(boss.actor, created.id, h.meta);
      await expect(
        staff.acceptInvite({ token: revokedToken, password: TEST_PASSWORD }, h.meta),
      ).rejects.toBeInstanceOf(TokenRejected);
      expect((await staff.listInvites(boss.actor)).map((i) => i.email)).not.toContain(revoked);
      h.advance(72 * 3600 + 1);
      await expect(
        staff.acceptInvite({ token: lapsedToken, password: TEST_PASSWORD }, h.meta),
      ).rejects.toMatchObject({ problem: 'expired' });
      await expect(
        staff.acceptInvite({ token: 'junk', password: TEST_PASSWORD }, h.meta),
      ).rejects.toMatchObject({ problem: 'invalid' });
    });

    it('a new invite for the same address voids the older one', async () => {
      const boss = await staffMember('admin');
      const email = address();
      await staff.createInvite(boss.actor, { email, role: 'editor' }, h.meta);
      const first = h.tokenFor(email);
      await staff.createInvite(boss.actor, { email, role: 'admin' }, h.meta);
      await expect(
        staff.acceptInvite({ token: first, password: TEST_PASSWORD }, h.meta),
      ).rejects.toBeInstanceOf(TokenRejected);
      const pending = (await staff.listInvites(boss.actor)).filter((i) => i.email === email);
      expect(pending).toHaveLength(1);
      expect(pending[0]?.role).toBe('admin');
    });

    it('shows an empty list when nothing is pending', async () => {
      const solo = new StaffService(h.deps);
      const boss = await staffMember('admin');
      const invites = await solo.listInvites(boss.actor);
      for (const invite of invites) await solo.revokeInvite(boss.actor, invite.id, h.meta);
      expect(await solo.listInvites(boss.actor)).toEqual([]);
    });
  });

  describe('roles', () => {
    it('changes a role, audits old and new, and ends the sessions of someone demoted to viewer', async () => {
      const boss = await staffMember('admin');
      const editor = await staffMember('editor');
      await staff.changeRole(
        boss.actor,
        { accountId: editor.member.id, role: 'viewer', expectedRole: 'editor' },
        h.meta,
      );
      expect(await h.deps.sessions.validate(editor.token)).toBeNull();
      const audit = await h.dbs.admin.db
        .select()
        .from(schema.auditLog)
        .where(eq(schema.auditLog.action, 'admin.role_changed'));
      expect(audit.at(-1)?.metadata).toMatchObject({ from: 'editor', to: 'viewer' });
    });

    it('ends the sessions of someone promoted, so the new role starts from a fresh sign in (L-7)', async () => {
      const boss = await staffMember('admin');
      const editor = await staffMember('editor');
      await staff.changeRole(
        boss.actor,
        { accountId: editor.member.id, role: 'admin', expectedRole: 'editor' },
        h.meta,
      );
      expect(await h.deps.sessions.validate(editor.token)).toBeNull();
    });

    it('ends the sessions of someone moved between staff roles in either direction (L-7)', async () => {
      const boss = await staffMember('admin');
      const other = await staffMember('admin');
      await staff.changeRole(
        boss.actor,
        { accountId: other.member.id, role: 'editor', expectedRole: 'admin' },
        h.meta,
      );
      expect(await h.deps.sessions.validate(other.token)).toBeNull();
    });

    it('the SQL role and status functions refuse a caller id that is not the request context (L-2)', async () => {
      const boss = await staffMember('admin');
      const editor = await staffMember('editor');
      const victim = await registerMember(h, staff);
      const call = (ctx: { accountId: string; role: 'admin' | 'viewer' } | null) => {
        const q = sql`SELECT staff_set_role(${boss.member.id}::uuid, ${editor.member.id}::uuid, 'viewer'::account_role, 'editor'::account_role)`;
        return ctx ? withAccount(h.dbs.app.db, ctx, (tx) => tx.execute(q)) : h.dbs.app.db.execute(q);
      };
      // No context at all, and a context for somebody else: both are refused even though p_actor is a real admin.
      await expect(call(null)).rejects.toThrow();
      await expect(call({ accountId: editor.member.id, role: 'admin' })).rejects.toThrow();
      const status = withAccount(h.dbs.app.db, { accountId: editor.member.id, role: 'admin' }, (tx) =>
        tx.execute(
          sql`SELECT staff_set_account_status(${boss.member.id}::uuid, ${victim.id}::uuid, 'suspended'::account_status, 'x')`,
        ),
      );
      await expect(status).rejects.toThrow();
      // The matching context works.
      await expect(call({ accountId: boss.member.id, role: 'admin' })).resolves.toBeDefined();
    });

    it('refuses a change to your own role, a stale view, and a caller who is not an admin', async () => {
      const boss = await staffMember('admin');
      const editor = await staffMember('editor');
      await expect(
        staff.changeRole(
          boss.actor,
          { accountId: boss.member.id, role: 'editor', expectedRole: 'admin' },
          h.meta,
        ),
      ).rejects.toBeInstanceOf(Forbidden);
      await expect(
        staff.changeRole(
          boss.actor,
          { accountId: editor.member.id, role: 'viewer', expectedRole: 'admin' },
          h.meta,
        ),
      ).rejects.toBeInstanceOf(Conflict);
      await expect(
        staff.changeRole(
          editor.actor,
          { accountId: boss.member.id, role: 'viewer', expectedRole: 'admin' },
          h.meta,
        ),
      ).rejects.toBeInstanceOf(Forbidden);
    });

    it('needs a recent password confirmation', async () => {
      const boss = await staffMember('admin');
      const editor = await staffMember('editor');
      h.advance(11 * 60);
      await expect(
        staff.changeRole(
          boss.actor,
          { accountId: editor.member.id, role: 'viewer', expectedRole: 'editor' },
          h.meta,
        ),
      ).rejects.toBeInstanceOf(ReauthRequired);
    });

    it('lists staff with role, last sign in and two factor state for admins only', async () => {
      const boss = await staffMember('admin');
      const editor = await staffMember('editor');
      const list = await staff.listStaff(boss.actor);
      const row = list.find((s) => s.accountId === editor.member.id);
      expect(row).toMatchObject({ email: editor.member.email, role: 'editor', twoFactor: true });
      await expect(staff.listStaff(editor.actor)).rejects.toBeInstanceOf(Forbidden);
    });
  });

  describe('two factor reset and self service', () => {
    it('lets an admin reset another account, confirmed with their own code, and mails that person', async () => {
      const boss = await staffMember('admin');
      const editor = await staffMember('editor');
      h.advance(31);
      const before = h.mailsTo(editor.member.email);
      await staff.resetTwoFactor(
        boss.actor,
        { accountId: editor.member.id, code: codeNow(boss.secret) },
        h.meta,
      );
      await h.settle();
      expect(await h.deps.sessions.validate(editor.token)).toBeNull();
      expect(
        await h.dbs.admin.db
          .select()
          .from(schema.mfaFactors)
          .where(eq(schema.mfaFactors.accountId, editor.member.id)),
      ).toHaveLength(0);
      expect(
        await h.dbs.admin.db
          .select()
          .from(schema.mfaRecoveryCodes)
          .where(eq(schema.mfaRecoveryCodes.accountId, editor.member.id)),
      ).toHaveLength(0);
      expect(h.mailsTo(editor.member.email)).toBe(before + 1);
      const login = await staff.adminSignIn(
        { email: editor.member.email, password: editor.member.password },
        h.meta,
      );
      expect(login.status).toBe('enrol_required');
    });

    it('refuses a self reset, a wrong code and a caller who is not an admin', async () => {
      const boss = await staffMember('admin');
      const editor = await staffMember('editor');
      h.advance(31);
      await expect(
        staff.resetTwoFactor(
          boss.actor,
          { accountId: boss.member.id, code: codeNow(boss.secret) },
          h.meta,
        ),
      ).rejects.toBeInstanceOf(Forbidden);
      await expect(
        staff.resetTwoFactor(boss.actor, { accountId: editor.member.id, code: '000000' }, h.meta),
      ).rejects.toBeInstanceOf(FieldErrors);
      await expect(
        staff.resetTwoFactor(
          editor.actor,
          { accountId: boss.member.id, code: codeNow(editor.secret) },
          h.meta,
        ),
      ).rejects.toBeInstanceOf(Forbidden);
    });

    it('regenerates recovery codes with a valid code and the old ones stop working', async () => {
      const s = await staffMember('editor');
      h.advance(31);
      const fresh = await staff.regenerateRecoveryCodes(
        s.actor,
        { code: codeNow(s.secret) },
        h.meta,
      );
      expect(fresh).toHaveLength(10);
      const { pending } = await loginPending(s.member, 'editor');
      await expect(
        staff.verifyRecoveryCode(pending, { code: s.recoveryCodes[0]! }, h.meta),
      ).rejects.toBeInstanceOf(FieldErrors);
      await expect(
        staff.verifyRecoveryCode(pending, { code: fresh[0]! }, h.meta),
      ).resolves.toBeDefined();
    });

    it('changes an admin password with the current password and a code, keeping a staff session', async () => {
      const s = await staffMember('admin');
      h.advance(31);
      const result = await staff.changeStaffPassword(
        s.actor,
        {
          currentPassword: s.member.password,
          newPassword: 'a-fresh-staff-secret-5',
          code: codeNow(s.secret),
        },
        h.meta,
      );
      expect(await h.deps.sessions.validate(s.token)).toBeNull();
      expect((await h.deps.sessions.validate(result.session.token))?.mfaVerified).toBe(true);
    });
  });
});
