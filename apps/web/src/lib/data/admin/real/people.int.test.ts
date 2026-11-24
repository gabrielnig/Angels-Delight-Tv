import { schema } from '@ad/db';
import { StaffService } from '@ad/auth';
import {
  createAuthHarness,
  registerMember,
  signInActor,
  type AuthHarness,
  type TestMember,
} from '@ad/auth/testing';
import { integrationEnabled } from '@ad/db/testing';
import { desc, eq, isNull, and } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setAdminRuntime } from '@/server/admin/runtime';
import type { AdminActor } from '../types';
import { realPeopleService } from './people';

describe.skipIf(!integrationEnabled())('real people service', () => {
  let h: AuthHarness;
  let staff: StaffService;
  let admin: AdminActor;
  let editor: AdminActor;
  let boss: AdminActor;
  let bossMember: TestMember;

  async function promote(role: 'editor' | 'admin' | 'super_admin') {
    const member = await registerMember(h, staff, {
      email: `${role}.${Math.random().toString(36).slice(2, 7)}@example.org`,
    });
    await h.dbs.admin.db
      .update(schema.accounts)
      .set({ role })
      .where(eq(schema.accounts.id, member.id));
    const session = await h.deps.sessions.create({ accountId: member.id, kind: 'staff' });
    const actor: AdminActor = {
      accountId: member.id,
      role,
      name: 'Test Staff',
      sessionId: session.session.id,
    };
    return { member, actor };
  }

  async function viewer(name: string, email?: string) {
    const member = await registerMember(h, staff, email ? { email } : {});
    const sealed = await h.deps.keys.seal(member.id, 'profile_name', name);
    await h.dbs.admin.db.insert(schema.profiles).values({
      accountId: member.id,
      nameEnc: Buffer.from(sealed),
      avatarId: 'sun',
      isPrimary: true,
    });
    return member;
  }

  const auditFor = async (targetId: string) =>
    h.dbs.admin.db
      .select()
      .from(schema.auditLog)
      .where(eq(schema.auditLog.targetId, targetId))
      .orderBy(desc(schema.auditLog.id));

  beforeAll(async () => {
    h = await createAuthHarness();
    staff = new StaffService(h.deps);
    setAdminRuntime({
      db: () => h.dbs.app.db,
      auth: () => ({ staff, sessions: h.deps.sessions, keys: h.deps.keys }),
      meta: async () => h.meta,
      now: () => h.deps.clock!(),
    });
    const a = await promote('admin');
    admin = a.actor;
    const b = await promote('super_admin');
    boss = b.actor;
    bossMember = b.member;
    editor = (await promote('editor')).actor;
  });
  afterAll(async () => {
    setAdminRuntime(null);
    await h?.drop();
  });

  it('is admin only', async () => {
    await expect(realPeopleService.users(editor, {})).rejects.toThrow();
    await expect(realPeopleService.staff(editor)).rejects.toThrow();
    const r = await realPeopleService.suspend(editor, admin.accountId, 'because');
    expect(r.ok).toBe(false);
  });

  it('lists viewers with decrypted email, profile names and live session counts', async () => {
    const amina = await viewer('Amina', 'amina.list@example.com');
    await signInActor(h, staff, amina);
    await signInActor(h, staff, amina);
    const users = await realPeopleService.users(admin, { q: 'amina.list' });
    expect(users).toHaveLength(1);
    expect(users[0]).toMatchObject({
      id: amina.id,
      email: 'amina.list@example.com',
      status: 'active',
      sessions: 3, // verifying the address signs in, then two more
      suspendedReason: null,
    });
    expect(users[0]!.profiles[0]).toMatchObject({ name: 'Amina', kids: false });
    expect(users[0]!.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('never lists staff as users and finds people by profile name', async () => {
    const chidi = await viewer('Chidiebere', 'chidi.find@example.com');
    const byName = await realPeopleService.users(admin, { q: 'chidieb' });
    expect(byName.map((u) => u.id)).toEqual([chidi.id]);
    const all = await realPeopleService.users(admin, {});
    expect(all.some((u) => u.id === admin.accountId)).toBe(false);
  });

  it('suspends with a reason, ends sessions and writes an audit row', async () => {
    const ife = await viewer('Ife', 'ife.susp@example.com');
    await signInActor(h, staff, ife);
    expect(await realPeopleService.suspend(admin, ife.id, 'ab')).toEqual({
      ok: false,
      error: 'Write a short reason. It is kept in the audit log.',
    });
    expect(await realPeopleService.suspend(admin, ife.id, '  Shared an account  ')).toEqual({
      ok: true,
    });
    const user = await realPeopleService.user(admin, ife.id);
    expect(user).toMatchObject({
      status: 'suspended',
      sessions: 0,
      suspendedReason: 'Shared an account',
    });
    expect(await realPeopleService.suspend(admin, ife.id, 'again please')).toEqual({
      ok: false,
      error: 'This account is already suspended.',
    });
    const rows = await auditFor(ife.id);
    expect(rows[0]).toMatchObject({ action: 'user.suspend', actorAccountId: admin.accountId });
    const live = await h.dbs.admin.db
      .select()
      .from(schema.sessions)
      .where(and(eq(schema.sessions.accountId, ife.id), isNull(schema.sessions.revokedAt)));
    expect(live).toHaveLength(0);
  });

  it('reinstates and says so when the account is already active', async () => {
    const tola = await viewer('Tola', 'tola.reinstate@example.com');
    expect(await realPeopleService.reinstate(admin, tola.id)).toEqual({
      ok: false,
      error: 'This account is already active.',
    });
    await realPeopleService.suspend(admin, tola.id, 'Chargeback dispute');
    expect(await realPeopleService.reinstate(admin, tola.id)).toEqual({ ok: true });
    expect(await realPeopleService.user(admin, tola.id)).toMatchObject({
      status: 'active',
      suspendedReason: null,
    });
    expect((await auditFor(tola.id))[0]).toMatchObject({ action: 'user.reinstate' });
  });

  it('refuses unknown people and staff accounts with the screen message', async () => {
    expect(
      await realPeopleService.suspend(
        admin,
        '0190a1b2-0000-7000-8000-000000000000',
        'valid reason',
      ),
    ).toEqual({ ok: false, error: 'User not found.' });
    expect(await realPeopleService.suspend(admin, editor.accountId, 'valid reason')).toEqual({
      ok: false,
      error: 'User not found.',
    });
  });

  it('signs a person out everywhere with a reason', async () => {
    const kemi = await viewer('Kemi', 'kemi.out@example.com');
    await signInActor(h, staff, kemi);
    expect((await realPeopleService.revokeSessions(admin, kemi.id, 'x')).ok).toBe(false);
    expect(await realPeopleService.revokeSessions(admin, kemi.id, 'Lost phone')).toEqual({
      ok: true,
    });
    expect((await realPeopleService.user(admin, kemi.id)).sessions).toBe(0);
    expect((await auditFor(kemi.id))[0]).toMatchObject({ action: 'user.sessions_revoked' });
  });

  it('bulk support actions are admin only, skip the actor and keep going after a skip', async () => {
    const a = await viewer('Bulk A', 'bulk.a@example.com');
    const b = await viewer('Bulk B', 'bulk.b@example.com');
    await expect(
      realPeopleService.bulkUsers(editor, [a.id], { type: 'suspend', reason: 'forged' }, 'x'),
    ).rejects.toThrow();
    expect((await realPeopleService.user(admin, a.id)).status).toBe('active');
    const out = await realPeopleService.bulkUsers(
      admin,
      [a.id, b.id, admin.accountId],
      { type: 'suspend', reason: 'Abuse reports' },
      'bulk-1',
    );
    expect(out.succeeded).toEqual([a.id, b.id]);
    expect(out.skipped).toEqual([
      { id: admin.accountId, reason: 'You cannot do this to your own account.' },
    ]);
    expect((await realPeopleService.user(admin, a.id)).status).toBe('suspended');
    const undone = await realPeopleService.undoUsers(admin, out.undo!);
    expect(undone.succeeded.sort()).toEqual([a.id, b.id].sort());
    expect((await realPeopleService.user(admin, a.id)).status).toBe('active');
  });

  describe('staff, invites and roles behind a recent password confirmation', () => {
    it('lists staff with names and two factor state, and starts with no invites', async () => {
      const result = await realPeopleService.staff(boss);
      const me = result.staff.find((m) => m.id === boss.accountId);
      expect(me).toMatchObject({ role: 'super_admin', twoFactor: false, email: bossMember.email });
      expect(me!.name.length).toBeGreaterThan(0);
      expect(result.invites).toEqual([]);
    });

    it('asks for the password before inviting and accepts it once confirmed', async () => {
      expect(await realPeopleService.invite(boss, 'new.editor@example.org', 'editor')).toEqual({
        ok: false,
        error: 'Confirm your password to continue.',
        reauth: true,
      });
      expect(await realPeopleService.reauthenticate(boss, 'wrong password here')).toEqual({
        ok: false,
        error: 'Password is not right',
      });
      expect(await realPeopleService.reauthenticate(boss, bossMember.password)).toEqual({
        ok: true,
      });
      expect(await realPeopleService.invite(boss, 'new.editor@example.org', 'editor')).toEqual({
        ok: true,
      });
      expect(h.mailsTo('new.editor@example.org')).toBe(1);
      const { invites } = await realPeopleService.staff(boss);
      expect(invites).toHaveLength(1);
      expect(invites[0]).toMatchObject({ email: 'new.editor@example.org', role: 'editor' });
      expect(invites[0]!.invitedBy.length).toBeGreaterThan(0);
    });

    it('rejects a bad address with the field message', async () => {
      const r = await realPeopleService.invite(boss, 'not an email', 'editor');
      expect(r.ok).toBe(false);
      expect(r).toHaveProperty('error', 'Enter a valid email address');
    });

    it('resends by replacing the invite and cancels one', async () => {
      const before = (await realPeopleService.staff(boss)).invites[0]!;
      expect(await realPeopleService.resendInvite(boss, before.id)).toEqual({ ok: true });
      const after = (await realPeopleService.staff(boss)).invites;
      expect(after).toHaveLength(1);
      expect(after[0]!.id).not.toBe(before.id);
      expect(h.mailsTo('new.editor@example.org')).toBe(2);
      expect(await realPeopleService.revokeInvite(boss, after[0]!.id)).toEqual({ ok: true });
      expect((await realPeopleService.staff(boss)).invites).toEqual([]);
      expect(await realPeopleService.resendInvite(boss, after[0]!.id)).toEqual({
        ok: false,
        error: 'That invite is no longer pending.',
      });
    });

    it('changes a role and refuses to change your own', async () => {
      const other = await promote('editor');
      expect(
        await realPeopleService.changeRole(boss, other.actor.accountId, 'super_admin'),
      ).toEqual({
        ok: true,
      });
      const roles = (await realPeopleService.staff(boss)).staff;
      expect(roles.find((m) => m.id === other.actor.accountId)?.role).toBe('super_admin');
      // A role change ends the target's sessions (L-7), so the promoted person needs a fresh one.
      const fresh = await h.deps.sessions.create({
        accountId: other.actor.accountId,
        kind: 'staff',
      });
      const promoted: AdminActor = {
        ...other.actor,
        role: 'super_admin',
        sessionId: fresh.session.id,
      };
      const target = await promote('editor');
      const denied = await realPeopleService.changeRole(promoted, target.actor.accountId, 'admin');
      expect(denied).toMatchObject({ ok: false, reauth: true });
      await realPeopleService.reauthenticate(promoted, other.member.password);
      expect(await realPeopleService.changeRole(promoted, target.actor.accountId, 'admin')).toEqual(
        { ok: true },
      );
      expect(await realPeopleService.changeRole(promoted, promoted.accountId, 'editor')).toEqual({
        ok: false,
        error: 'You cannot change this role',
      });
    });

    it('refuses an admin every Super admin action with a plain message and changes nothing', async () => {
      await expect(realPeopleService.staff(admin)).rejects.toThrow();
      const other = await promote('editor');
      expect(await realPeopleService.invite(admin, 'x.admin@example.org', 'editor')).toEqual({
        ok: false,
        error: 'You do not have permission for this.',
      });
      expect(await realPeopleService.changeRole(admin, other.actor.accountId, 'admin')).toEqual({
        ok: false,
        error: 'You do not have permission for this.',
      });
      expect(
        await realPeopleService.resetTwoFactor(admin, other.actor.accountId, '123456'),
      ).toEqual({
        ok: false,
        error: 'You do not have permission for this.',
      });
      const [row] = await h.dbs.admin.db
        .select({ role: schema.accounts.role })
        .from(schema.accounts)
        .where(eq(schema.accounts.id, other.actor.accountId));
      expect(row?.role).toBe('editor');
    });

    it('deletes a viewer account only for a Super admin, after the typed word', async () => {
      const owner = await viewer('Owner Request', 'owner.request@example.org');
      expect(await realPeopleService.deleteAccount(admin, owner.id, 'DELETE')).toEqual({
        ok: false,
        error: 'You do not have permission for this.',
      });
      expect(await realPeopleService.deleteAccount(boss, owner.id, 'delete')).toMatchObject({
        ok: false,
      });
      await realPeopleService.reauthenticate(boss, bossMember.password);
      expect(await realPeopleService.deleteAccount(boss, owner.id, 'DELETE')).toEqual({ ok: true });
      const [row] = await h.dbs.admin.db
        .select({ status: schema.accounts.status })
        .from(schema.accounts)
        .where(eq(schema.accounts.id, owner.id));
      expect(row?.status).toBe('pending_deletion');
    });

    it('reports a missing person plainly', async () => {
      expect(
        await realPeopleService.changeRole(boss, '0190a1b2-0000-7000-8000-000000000000', 'admin'),
      ).toEqual({ ok: false, error: 'That person was not found.' });
    });
  });
});
