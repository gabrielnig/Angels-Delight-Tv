import { schema, withAccount } from '@ad/db';
import { integrationEnabled } from '@ad/db/testing';
import { Conflict, Forbidden, NotFound, type AccountRole } from '@ad/shared';
import { FieldErrors } from './types';
import { and, eq, ne, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { StaffService } from './staff';
import { base32Decode, totpAt } from './totp';
import { createAuthHarness, registerMember, type AuthHarness } from './testing';

type StaffRoleName = 'editor' | 'admin' | 'super_admin';

describe.skipIf(!integrationEnabled())('Super admin only actions (D-128)', () => {
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

  async function staffMember(role: StaffRoleName) {
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
      token: done.session.token,
      actor: { accountId: member.id, role, sessionId: context!.sessionId },
    };
  }

  const reauth = async (s: Awaited<ReturnType<typeof staffMember>>) =>
    staff.reauthenticate(s.actor, s.member.password, h.meta);

  describe('an admin is refused every Super admin action', () => {
    it('cannot list staff, invite, revoke, change roles or reset 2FA', async () => {
      const boss = await staffMember('super_admin');
      const admin = await staffMember('admin');
      const editor = await staffMember('editor');
      await reauth(admin);
      await expect(staff.listStaff(admin.actor)).rejects.toBeInstanceOf(Forbidden);
      await expect(
        staff.createInvite(admin.actor, { email: 'x1@example.org', role: 'editor' }, h.meta),
      ).rejects.toBeInstanceOf(Forbidden);
      await expect(staff.listInvites(admin.actor)).rejects.toBeInstanceOf(Forbidden);
      await expect(
        staff.revokeInvite(admin.actor, '00000000-0000-7000-8000-000000000001', h.meta),
      ).rejects.toBeInstanceOf(Forbidden);
      await expect(
        staff.changeRole(
          admin.actor,
          { accountId: editor.member.id, role: 'viewer', expectedRole: 'editor' },
          h.meta,
        ),
      ).rejects.toBeInstanceOf(Forbidden);
      h.advance(31);
      await expect(
        staff.resetTwoFactor(
          admin.actor,
          { accountId: editor.member.id, code: codeNow(admin.secret) },
          h.meta,
        ),
      ).rejects.toBeInstanceOf(Forbidden);
      expect(boss.member.id).toBeDefined();
    });

    it('cannot promote itself or another admin to Super admin', async () => {
      await staffMember('super_admin');
      const admin = await staffMember('admin');
      const other = await staffMember('admin');
      await reauth(admin);
      for (const target of [admin, other]) {
        await expect(
          staff.changeRole(
            admin.actor,
            { accountId: target.member.id, role: 'super_admin', expectedRole: 'admin' },
            h.meta,
          ),
        ).rejects.toBeInstanceOf(Forbidden);
      }
      const rows = await h.dbs.admin.db
        .select({ role: schema.accounts.role })
        .from(schema.accounts)
        .where(eq(schema.accounts.id, admin.member.id));
      expect(rows[0]?.role).toBe('admin');
    });

    it('is refused in SQL too when the staff_set_role function is called directly', async () => {
      await staffMember('super_admin');
      const admin = await staffMember('admin');
      const editor = await staffMember('editor');
      const call = () =>
        withAccount(h.deps.db, { accountId: admin.member.id, role: 'admin' }, (tx) =>
          tx.execute(
            sql`SELECT staff_set_role(${admin.member.id}::uuid, ${editor.member.id}::uuid, 'super_admin'::account_role, 'editor'::account_role)`,
          ),
        );
      await expect(call()).rejects.toThrow();
      const rows = await h.dbs.admin.db
        .select({ role: schema.accounts.role })
        .from(schema.accounts)
        .where(eq(schema.accounts.id, editor.member.id));
      expect(rows[0]?.role).toBe('editor');
    });
  });

  describe('a forged or stale actor gains nothing', () => {
    it('trusts the database role, not the role carried by the caller', async () => {
      await staffMember('super_admin');
      const admin = await staffMember('admin');
      await reauth(admin);
      const forged = { ...admin.actor, role: 'super_admin' as AccountRole };
      await expect(staff.listStaff(forged as never)).rejects.toBeInstanceOf(Forbidden);
      await expect(
        staff.createInvite(forged as never, { email: 'x2@example.org', role: 'admin' }, h.meta),
      ).rejects.toBeInstanceOf(Forbidden);
    });

    it('refuses a Super admin who was demoted after the session started', async () => {
      await staffMember('super_admin');
      const boss = await staffMember('super_admin');
      await h.dbs.admin.db
        .update(schema.accounts)
        .set({ role: 'admin' })
        .where(eq(schema.accounts.id, boss.member.id));
      await expect(staff.listStaff(boss.actor)).rejects.toBeInstanceOf(Forbidden);
    });

    it('refuses a suspended Super admin', async () => {
      await staffMember('super_admin');
      const boss = await staffMember('super_admin');
      await h.dbs.admin.db
        .update(schema.accounts)
        .set({ status: 'suspended' })
        .where(eq(schema.accounts.id, boss.member.id));
      await expect(staff.listStaff(boss.actor)).rejects.toBeInstanceOf(Forbidden);
    });
  });

  describe('a Super admin', () => {
    it('lists staff, invites any staff role and changes roles with an audit entry', async () => {
      const boss = await staffMember('super_admin');
      const admin = await staffMember('admin');
      await reauth(boss);
      const list = await staff.listStaff(boss.actor);
      expect(list.find((m) => m.accountId === admin.member.id)?.role).toBe('admin');
      expect(list.find((m) => m.accountId === boss.member.id)?.role).toBe('super_admin');
      await staff.createInvite(
        boss.actor,
        { email: 'new-super@example.org', role: 'super_admin' },
        h.meta,
      );
      await staff.changeRole(
        boss.actor,
        { accountId: admin.member.id, role: 'editor', expectedRole: 'admin' },
        h.meta,
      );
      const audit = await h.dbs.admin.db
        .select()
        .from(schema.auditLog)
        .where(eq(schema.auditLog.action, 'admin.role_changed'));
      expect(audit.at(-1)?.metadata).toMatchObject({ from: 'admin', to: 'editor' });
      expect(audit.at(-1)?.actorRole).toBe('super_admin');
    });

    it('can promote an admin to Super admin', async () => {
      const boss = await staffMember('super_admin');
      const admin = await staffMember('admin');
      await reauth(boss);
      await staff.changeRole(
        boss.actor,
        { accountId: admin.member.id, role: 'super_admin', expectedRole: 'admin' },
        h.meta,
      );
      const rows = await h.dbs.admin.db
        .select({ role: schema.accounts.role })
        .from(schema.accounts)
        .where(eq(schema.accounts.id, admin.member.id));
      expect(rows[0]?.role).toBe('super_admin');
    });

    it('cannot change its own role even while another Super admin exists', async () => {
      const boss = await staffMember('super_admin');
      await staffMember('super_admin');
      await reauth(boss);
      await expect(
        staff.changeRole(
          boss.actor,
          { accountId: boss.member.id, role: 'admin', expectedRole: 'super_admin' },
          h.meta,
        ),
      ).rejects.toBeInstanceOf(Forbidden);
    });

    it('cannot reset its own two factor, but can reset an admin with its own code', async () => {
      const boss = await staffMember('super_admin');
      const admin = await staffMember('admin');
      h.advance(31);
      await expect(
        staff.resetTwoFactor(
          boss.actor,
          { accountId: boss.member.id, code: codeNow(boss.secret) },
          h.meta,
        ),
      ).rejects.toBeInstanceOf(Forbidden);
      h.advance(31);
      await staff.resetTwoFactor(
        boss.actor,
        { accountId: admin.member.id, code: codeNow(boss.secret) },
        h.meta,
      );
      expect(
        await h.dbs.admin.db
          .select()
          .from(schema.mfaFactors)
          .where(eq(schema.mfaFactors.accountId, admin.member.id)),
      ).toHaveLength(0);
    });
  });

  describe('the last Super admin guard', () => {
    /** Leaves exactly one active Super admin in this database. */
    async function soleSuper() {
      const sole = await staffMember('super_admin');
      await h.dbs.admin.db
        .update(schema.accounts)
        .set({ role: 'admin' })
        .where(
          and(eq(schema.accounts.role, 'super_admin'), ne(schema.accounts.id, sole.member.id)),
        );
      return sole;
    }

    it('blocks demoting the last Super admin through a second Super admin acting after a swap', async () => {
      const only = await soleSuper();
      const other = await staffMember('admin');
      await reauth(only);
      // Only Super admins may change roles, and the last one cannot change themself.
      await expect(
        staff.changeRole(
          only.actor,
          { accountId: only.member.id, role: 'admin', expectedRole: 'super_admin' },
          h.meta,
        ),
      ).rejects.toBeInstanceOf(Forbidden);
      expect(other.member.id).toBeDefined();
    });

    const refusal = async (run: Promise<unknown>): Promise<string> => {
      try {
        await run;
      } catch (error) {
        return String((error as { cause?: { message?: string } }).cause?.message ?? error);
      }
      return 'not refused';
    };

    it('blocks the database from losing its last active Super admin by demotion, suspension or deletion', async () => {
      const only = await soleSuper();
      const db = h.dbs.admin.db;
      const id = eq(schema.accounts.id, only.member.id);
      expect(await refusal(db.update(schema.accounts).set({ role: 'admin' }).where(id))).toMatch(
        /last active Super admin/i,
      );
      expect(
        await refusal(db.update(schema.accounts).set({ status: 'suspended' }).where(id)),
      ).toMatch(/last active Super admin/i);
      expect(await refusal(db.delete(schema.accounts).where(id))).toMatch(
        /last active Super admin/i,
      );
    });

    it('allows the swap when a second active Super admin exists', async () => {
      const first = await soleSuper();
      const second = await staffMember('admin');
      await reauth(first);
      await staff.changeRole(
        first.actor,
        { accountId: second.member.id, role: 'super_admin', expectedRole: 'admin' },
        h.meta,
      );
      await h.dbs.admin.db
        .update(schema.accounts)
        .set({ role: 'admin' })
        .where(eq(schema.accounts.id, first.member.id));
    });

    it('maps a conflict from a concurrent change to a clear message', async () => {
      const boss = await staffMember('super_admin');
      const admin = await staffMember('admin');
      await reauth(boss);
      await expect(
        staff.changeRole(
          boss.actor,
          { accountId: admin.member.id, role: 'editor', expectedRole: 'editor' },
          h.meta,
        ),
      ).rejects.toBeInstanceOf(Conflict);
    });
  });

  describe('deleting a viewer account (M27-S03 AC3)', () => {
    async function viewer() {
      const member = await registerMember(h, staff);
      return member;
    }
    const state = async (id: string) => {
      const [row] = await h.dbs.admin.db
        .select({ status: schema.accounts.status })
        .from(schema.accounts)
        .where(eq(schema.accounts.id, id));
      return row?.status;
    };

    it('is refused for an admin, an editor and a forged role, and nothing changes', async () => {
      await staffMember('super_admin');
      const admin = await staffMember('admin');
      const editor = await staffMember('editor');
      const target = await viewer();
      for (const actor of [
        admin.actor,
        editor.actor,
        { ...admin.actor, role: 'super_admin' as never },
      ]) {
        await expect(
          staff.deleteViewerAccount(
            actor,
            { accountId: target.id, confirmation: 'DELETE' },
            h.meta,
          ),
        ).rejects.toBeInstanceOf(Forbidden);
      }
      expect(await state(target.id)).toBe('active');
    });

    it('is refused in SQL when an admin calls the function directly', async () => {
      await staffMember('super_admin');
      const admin = await staffMember('admin');
      const target = await viewer();
      await expect(
        withAccount(h.deps.db, { accountId: admin.member.id, role: 'admin' }, (tx) =>
          tx.execute(
            sql`SELECT staff_request_account_deletion(${admin.member.id}::uuid, ${target.id}::uuid, now() + interval '14 days')`,
          ),
        ),
      ).rejects.toThrow();
      expect(await state(target.id)).toBe('active');
    });

    it('needs the typed word, and refuses staff targets and the caller themself', async () => {
      const boss = await staffMember('super_admin');
      const admin = await staffMember('admin');
      const target = await viewer();
      await expect(
        staff.deleteViewerAccount(
          boss.actor,
          { accountId: target.id, confirmation: 'delete' },
          h.meta,
        ),
      ).rejects.toBeInstanceOf(FieldErrors);
      await expect(
        staff.deleteViewerAccount(
          boss.actor,
          { accountId: boss.member.id, confirmation: 'DELETE' },
          h.meta,
        ),
      ).rejects.toBeInstanceOf(Forbidden);
      await expect(
        staff.deleteViewerAccount(
          boss.actor,
          { accountId: admin.member.id, confirmation: 'DELETE' },
          h.meta,
        ),
      ).rejects.toBeInstanceOf(NotFound);
      expect(await state(target.id)).toBe('active');
    });

    it('schedules the deletion, ends sessions, mails the owner and audits it', async () => {
      const boss = await staffMember('super_admin');
      const target = await viewer();
      const before = h.mailsTo(target.email);
      const result = await staff.deleteViewerAccount(
        boss.actor,
        { accountId: target.id, confirmation: 'DELETE' },
        h.meta,
      );
      await h.settle();
      expect(result.purgeAfter.getTime()).toBeGreaterThan(h.deps.clock!().getTime());
      expect(await state(target.id)).toBe('pending_deletion');
      expect(h.mailsTo(target.email)).toBe(before + 1);
      const audit = await h.dbs.admin.db
        .select()
        .from(schema.auditLog)
        .where(eq(schema.auditLog.action, 'admin.account_deletion_requested'));
      expect(audit.at(-1)).toMatchObject({ actorRole: 'super_admin', targetId: target.id });
    });
  });
});
