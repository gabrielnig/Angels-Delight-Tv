import { base32Decode, StaffService, totpAt } from '@ad/auth';
import {
  createAuthHarness,
  registerMember,
  TEST_PASSWORD,
  type AuthHarness,
} from '@ad/auth/testing';
import { schema } from '@ad/db';
import { integrationEnabled } from '@ad/db/testing';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setAdminRuntime, staffNames } from '@/server/admin/runtime';
import type { AdminActor } from '../types';
import { realAccountService } from './account';
import { realPeopleService } from './people';

const NEW_PASSWORD = 'harbour-copper-77-violet';

describe.skipIf(!integrationEnabled())('real my account and two factor reset', () => {
  let h: AuthHarness;
  let staff: StaffService;
  const adopted: string[] = [];

  const codeNow = (secret: string) => totpAt(base32Decode(secret), h.deps.clock!().getTime());

  /** An enrolled staff member: password, authenticator secret and a verified session. */
  async function enrolled(role: 'editor' | 'admin' | 'super_admin') {
    const member = await registerMember(h, staff, {
      email: `${role}.${Math.random().toString(36).slice(2, 7)}@example.org`,
    });
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
    const actor: AdminActor = {
      accountId: member.id,
      role,
      name: 'Someone',
      sessionId: context!.sessionId,
    };
    return { member, actor, secret: enrolment.secret, recovery: done.recoveryCodes };
  }
  /** A fresh authenticator code, one step later than the last one used. */
  const fresh = (secret: string) => {
    h.advance(31);
    return codeNow(secret);
  };

  beforeAll(async () => {
    h = await createAuthHarness();
    staff = new StaffService(h.deps);
    setAdminRuntime({
      db: () => h.dbs.app.db,
      auth: () => ({ staff, sessions: h.deps.sessions, keys: h.deps.keys }),
      meta: async () => h.meta,
      now: () => h.deps.clock!(),
      setSession: async (token) => {
        adopted.push(token);
      },
    });
  });
  afterAll(async () => {
    setAdminRuntime(null);
    await h?.drop();
  });

  it('shows the account with a name from the address, two factor and recovery codes left', async () => {
    const { actor, member } = await enrolled('editor');
    const account = await realAccountService.get(actor);
    expect(account).toMatchObject({
      accountId: member.id,
      email: member.email,
      twoFactor: true,
      recoveryCodesLeft: 10,
    });
    expect(account.name.length).toBeGreaterThan(0);
    expect(account.passwordChangedAt).toMatch(/^\d{4}-/);
    const current = account.sessions.find((s) => s.current);
    expect(current).toBeTruthy();
    expect(current!.device).toBeTruthy();
  });

  it('saves a display name, validates it and audits the change', async () => {
    const { actor } = await enrolled('editor');
    expect(await realAccountService.updateName(actor, 'A')).toEqual({
      ok: false,
      field: 'name',
      error: 'Use at least 2 characters.',
    });
    expect(await realAccountService.updateName(actor, '  Sister   Vanessa ')).toEqual({ ok: true });
    expect((await realAccountService.get(actor)).name).toBe('Sister Vanessa');
    const [row] = await h.dbs.admin.db
      .select()
      .from(schema.auditLog)
      .where(eq(schema.auditLog.targetId, actor.accountId))
      .orderBy(desc(schema.auditLog.id));
    expect(row).toMatchObject({ action: 'account.update', actorAccountId: actor.accountId });
  });

  it('shows the saved name to other staff in the directory', async () => {
    const a = await enrolled('admin');
    const b = await enrolled('editor');
    await realAccountService.updateName(b.actor, 'Ngozi Eze');
    const names = await staffNames(
      h.dbs.app.db,
      h.deps.keys,
      { accountId: a.actor.accountId, role: 'admin' },
      [b.actor.accountId],
    );
    expect(names.get(b.actor.accountId)).toBe('Ngozi Eze');
  });

  it('signs out another device but not this one', async () => {
    const { actor, member } = await enrolled('editor');
    const before = (await realAccountService.get(actor)).sessions.length;
    const other = await h.deps.sessions.create({ accountId: member.id, kind: 'staff' });
    const listed = await realAccountService.get(actor);
    expect(listed.sessions).toHaveLength(before + 1);
    expect(await realAccountService.revokeSession(actor, actor.sessionId!)).toEqual({
      ok: false,
      field: 'session',
      error: 'This is the device you are using. Sign out from the menu instead.',
    });
    expect(await realAccountService.revokeSession(actor, other.session.id)).toEqual({ ok: true });
    expect(await realAccountService.revokeSession(actor, other.session.id)).toEqual({
      ok: false,
      field: 'session',
      error: 'That session is already gone.',
    });
  });

  it('changes the password with the authenticator code and keeps this device signed in', async () => {
    const { actor, member, secret } = await enrolled('editor');
    const stray = await h.deps.sessions.create({ accountId: member.id, kind: 'staff' });
    expect(
      await realAccountService.changePassword(actor, 'wrong', NEW_PASSWORD, NEW_PASSWORD, '123456'),
    ).toMatchObject({ ok: false, field: 'code' });
    expect(
      await realAccountService.changePassword(
        actor,
        TEST_PASSWORD,
        NEW_PASSWORD,
        NEW_PASSWORD + 'x',
        fresh(secret),
      ),
    ).toEqual({ ok: false, field: 'confirm', error: 'The two passwords do not match.' });
    expect(
      await realAccountService.changePassword(
        actor,
        'wrong',
        NEW_PASSWORD,
        NEW_PASSWORD,
        fresh(secret),
      ),
    ).toMatchObject({ ok: false, field: 'current' });
    adopted.length = 0;
    expect(
      await realAccountService.changePassword(
        actor,
        TEST_PASSWORD,
        NEW_PASSWORD,
        NEW_PASSWORD,
        fresh(secret),
      ),
    ).toEqual({ ok: true });
    expect(adopted).toHaveLength(1);
    const live = await h.dbs.admin.db
      .select()
      .from(schema.sessions)
      .where(and(eq(schema.sessions.accountId, member.id), isNull(schema.sessions.revokedAt)));
    expect(live).toHaveLength(1);
    expect(live[0]!.id).not.toBe(stray.session.id);
    const signIn = await staff.adminSignIn({ email: member.email, password: NEW_PASSWORD }, h.meta);
    expect(signIn.status).toBe('mfa_required');
  });

  it('makes new recovery codes with the authenticator code only', async () => {
    const { actor, secret, recovery } = await enrolled('editor');
    expect(await realAccountService.regenerateCodes(actor, '000000')).toMatchObject({
      ok: false,
      field: 'code',
    });
    const result = await realAccountService.regenerateCodes(actor, fresh(secret));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.codes).toHaveLength(10);
      expect(result.codes).not.toContain(recovery[0]);
    }
    expect((await realAccountService.get(actor)).recoveryCodesLeft).toBe(10);
  });

  describe("resetting someone else's two factor", () => {
    it('needs the super admin code, then clears the other person factor', async () => {
      const boss = await enrolled('super_admin');
      const target = await enrolled('editor');
      expect(
        await realPeopleService.resetTwoFactor(boss.actor, target.actor.accountId, '000000'),
      ).toMatchObject({ ok: false });
      expect(
        await realPeopleService.resetTwoFactor(
          boss.actor,
          target.actor.accountId,
          fresh(boss.secret),
        ),
      ).toEqual({ ok: true });
      const { staff: members } = await realPeopleService.staff(boss.actor);
      expect(members.find((m) => m.id === target.actor.accountId)?.twoFactor).toBe(false);
    });

    it('refuses to reset your own and refuses editors and plain admins', async () => {
      const boss = await enrolled('super_admin');
      const editor = await enrolled('editor');
      const plain = await enrolled('admin');
      expect(
        await realPeopleService.resetTwoFactor(plain.actor, editor.actor.accountId, '123456'),
      ).toMatchObject({ ok: false, error: 'You do not have permission for this.' });
      expect(
        await realPeopleService.resetTwoFactor(
          boss.actor,
          boss.actor.accountId,
          fresh(boss.secret),
        ),
      ).toMatchObject({ ok: false });
      expect(
        await realPeopleService.resetTwoFactor(editor.actor, boss.actor.accountId, '123456'),
      ).toMatchObject({ ok: false, error: 'You do not have permission for this.' });
    });
  });
});
