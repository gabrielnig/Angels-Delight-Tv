import 'server-only';
import { runStaffBulk, type StaffBulkService } from '../staff-bulk';
import { runUserBulk, undoUserBulk, userBulkFor } from '../user-bulk';
import { writeAudit } from '@ad/audit';
import { schema } from '@ad/db';
import { withAccount } from '@ad/db';
import { NotFound, type Actor } from '@ad/shared';
import { and, desc, eq, gt, inArray, isNull, sql, type SQL } from 'drizzle-orm';
import { adminRuntime, titleCaseFromEmail } from '@/server/admin/runtime';
import type { PeopleService } from '../services';
import type { InviteRecord, StaffRecord, UserRecord } from '../types';
import { filterUsers, maskEmail } from '../users-commands';
import type { CommandResult } from '../video-commands';
import { catalogActor, need } from './shared';
import { inviteMailFailure, staffFailure } from './staff-errors';

const OK: CommandResult = { ok: true };
const fail = (error: string): CommandResult => ({ ok: false, error });
const PROFILE_NAME = 'profile_name';
const MAX_USERS = 5000;
const NOT_FOUND = 'User not found.';
const REASON = 'Write a short reason. It is kept in the audit log.';

async function loadUsers(actor: Actor, only?: SQL): Promise<UserRecord[]> {
  const { db, auth } = { db: adminRuntime().db(), auth: adminRuntime().auth() };
  const now = adminRuntime().now();
  const { accounts, profiles, sessions } = schema;
  const { rows, profs, live } = await withAccount(db, actor, async (tx) => {
    const rows = await tx
      .select({
        id: accounts.id,
        emailEnc: accounts.emailEnc,
        status: accounts.status,
        createdAt: accounts.createdAt,
        lastLoginAt: accounts.lastLoginAt,
        suspendedReason: accounts.suspendedReason,
      })
      .from(accounts)
      .where(
        and(eq(accounts.role, 'viewer'), inArray(accounts.status, ['active', 'suspended']), only),
      )
      .orderBy(desc(accounts.createdAt))
      .limit(MAX_USERS);
    const ids = rows.map((r) => r.id);
    if (!ids.length) return { rows, profs: [], live: [] };
    const profs = await tx
      .select({
        id: profiles.id,
        accountId: profiles.accountId,
        nameEnc: profiles.nameEnc,
        isKids: profiles.isKids,
        position: profiles.position,
      })
      .from(profiles)
      .where(inArray(profiles.accountId, ids))
      .orderBy(profiles.position, profiles.createdAt);
    const live = await tx
      .select({ accountId: sessions.accountId, count: sql<number>`count(*)::int` })
      .from(sessions)
      .where(
        and(
          inArray(sessions.accountId, ids),
          isNull(sessions.revokedAt),
          gt(sessions.idleExpiresAt, now),
          gt(sessions.absoluteExpiresAt, now),
        ),
      )
      .groupBy(sessions.accountId);
    return { rows, profs, live };
  });
  const sessionCount = new Map(live.map((l) => [l.accountId, l.count]));
  const open = async (id: string, column: string, sealed: Uint8Array | null) => {
    if (!sealed) return null;
    try {
      return await auth.keys.open(id, column, new Uint8Array(sealed));
    } catch {
      return null;
    }
  };
  const out: UserRecord[] = [];
  for (const row of rows) {
    const mine = profs.filter((p) => p.accountId === row.id);
    out.push({
      id: row.id,
      email: (await open(row.id, 'email', row.emailEnc)) ?? maskEmail('unknown@unknown'),
      status: row.status === 'suspended' ? 'suspended' : 'active',
      createdAt: row.createdAt.toISOString(),
      lastActiveAt: row.lastLoginAt ? row.lastLoginAt.toISOString() : null,
      profiles: await Promise.all(
        mine.map(async (p) => ({
          id: p.id,
          name: (await open(row.id, PROFILE_NAME, p.nameEnc)) ?? 'Profile',
          kids: p.isKids,
        })),
      ),
      sessions: sessionCount.get(row.id) ?? 0,
      suspendedReason: row.suspendedReason,
    });
  }
  return out;
}

function staffActor(actor: { accountId: string; role: string; sessionId?: string }) {
  if (!actor.sessionId) throw new Error('This action needs a signed in staff session');
  return {
    accountId: actor.accountId,
    role: actor.role as 'editor' | 'admin' | 'super_admin',
    sessionId: actor.sessionId,
  };
}

async function changeStatus(
  actor: Parameters<PeopleService['suspend']>[0],
  id: string,
  to: 'active' | 'suspended',
  reason: string,
): Promise<CommandResult> {
  const rt = adminRuntime();
  const who = catalogActor(actor);
  const [current] = await loadUsers(who, eq(schema.accounts.id, id));
  if (!current) return fail(NOT_FOUND);
  if (to === 'suspended') {
    if (reason.trim().length < 3) return fail(REASON);
    if (current.status === 'suspended') return fail('This account is already suspended.');
  } else if (current.status === 'active') return fail('This account is already active.');
  const kept = reason.trim().slice(0, 200);
  await withAccount(rt.db(), who, async (tx) => {
    await tx.execute(
      sql`SELECT staff_set_account_status(${actor.accountId}::uuid, ${id}::uuid, ${to}::account_status, ${to === 'suspended' ? kept : null})`,
    );
    await writeAudit(tx, {
      action: to === 'suspended' ? 'user.suspend' : 'user.reinstate',
      outcome: 'success',
      actorAccountId: actor.accountId,
      actorRole: actor.role,
      targetType: 'user',
      targetId: id,
      summary: `${to === 'suspended' ? 'Suspended' : 'Reinstated'} ${maskEmail(current.email)}`,
      before: { status: current.status },
      after: to === 'suspended' ? { status: to, reason: kept } : { status: to },
    });
  });
  if (to === 'suspended') await rt.auth().sessions.revokeAll(id);
  return OK;
}

export const realPeopleService: PeopleService = {
  async users(actor, query) {
    need(actor, 'users.view');
    return filterUsers(await loadUsers(catalogActor(actor)), query);
  },
  async user(actor, id) {
    need(actor, 'users.view');
    const [user] = await loadUsers(catalogActor(actor), eq(schema.accounts.id, id));
    if (!user) throw new NotFound('User not found');
    return user;
  },
  async suspend(actor, id, reason) {
    try {
      need(actor, 'users.suspend');
    } catch (error) {
      return staffFailure(error);
    }
    return changeStatus(actor, id, 'suspended', reason);
  },
  async reinstate(actor, id) {
    try {
      need(actor, 'users.suspend');
    } catch (error) {
      return staffFailure(error);
    }
    return changeStatus(actor, id, 'active', '');
  },
  async bulkUsers(actor, ids, action, bulkId) {
    need(actor, 'users.bulk');
    return runUserBulk(userBulkFor(realPeopleService, actor), actor.accountId, ids, action, bulkId);
  },
  async undoUsers(actor, undo) {
    need(actor, 'users.bulk');
    return undoUserBulk(userBulkFor(realPeopleService, actor), actor.accountId, undo);
  },
  async resetViewerTwoFactor(actor, id, reason) {
    try {
      need(actor, 'users.suspend');
      const rt = adminRuntime();
      const mfa = rt.auth().viewerMfa;
      if (!mfa) return fail('Two step verification is not available here.');
      await mfa.adminReset(staffActor(actor), { accountId: id, reason }, await rt.meta());
      return OK;
    } catch (error) {
      return staffFailure(error);
    }
  },
  async revokeSessions(actor, id, reason) {
    try {
      need(actor, 'users.suspend');
    } catch (error) {
      return staffFailure(error);
    }
    const rt = adminRuntime();
    const who = catalogActor(actor);
    const [current] = await loadUsers(who, eq(schema.accounts.id, id));
    if (!current) return fail(NOT_FOUND);
    if (reason.trim().length < 3) return fail(REASON);
    await rt.auth().sessions.revokeAll(id);
    await withAccount(rt.db(), who, (tx) =>
      writeAudit(tx, {
        action: 'user.sessions_revoked',
        outcome: 'success',
        actorAccountId: actor.accountId,
        actorRole: actor.role,
        targetType: 'user',
        targetId: id,
        summary: `Signed ${maskEmail(current.email)} out everywhere`,
        extra: { reason: reason.trim().slice(0, 200) },
      }),
    );
    return OK;
  },

  async staff(actor) {
    need(actor, 'roles.view');
    const { staff } = adminRuntime().auth();
    const who = staffActor(actor);
    const members = await staff.listStaff(who);
    const names = new Map(members.map((m) => [m.accountId, titleCaseFromEmail(m.email)]));
    const pending = await staff.listInvites(who);
    const inviters = pending.length
      ? await adminRuntime()
          .db()
          .select({ id: schema.adminInvites.id, by: schema.adminInvites.invitedBy })
          .from(schema.adminInvites)
          .where(
            inArray(
              schema.adminInvites.id,
              pending.map((i) => i.id),
            ),
          )
      : [];
    const by = new Map(inviters.map((r) => [r.id, r.by]));
    const staffRecords: StaffRecord[] = members.map((m) => ({
      id: m.accountId,
      name: names.get(m.accountId) ?? 'Staff',
      email: m.email,
      role: m.role,
      twoFactor: m.twoFactor,
      lastSignInAt: m.lastLoginAt ? m.lastLoginAt.toISOString() : null,
    }));
    const invites: InviteRecord[] = pending.map((i) => ({
      id: i.id,
      email: i.email,
      role: i.role,
      invitedBy: names.get(by.get(i.id) ?? '') ?? 'a former admin',
      createdAt: i.createdAt.toISOString(),
      expiresAt: i.expiresAt.toISOString(),
    }));
    return { staff: staffRecords, invites };
  },

  async bulkPreflight(actor) {
    try {
      need(actor, 'roles.bulk');
      await adminRuntime().auth().staff.assertRecentReauth(staffActor(actor));
      return OK;
    } catch (error) {
      return staffFailure(error);
    }
  },
  async bulkStaff(actor, ids, action, bulkId) {
    need(actor, 'roles.bulk');
    const rt = adminRuntime();
    const who = staffActor(actor);
    await rt.auth().staff.assertRecentReauth(who);
    const service: StaffBulkService = {
      async staff() {
        return (await rt.auth().staff.listStaff(who)).map((m) => ({
          id: m.accountId,
          role: m.role,
        }));
      },
      async invites() {
        return (await rt.auth().staff.listInvites(who)).map((i) => ({
          id: i.id,
          createdAt: i.createdAt.toISOString(),
        }));
      },
      changeRole: (id, role) => realPeopleService.changeRole(actor, id, role),
      resend: (id) => realPeopleService.resendInvite(actor, id),
    };
    return runStaffBulk(service, actor.accountId, ids, action, bulkId, rt.now().getTime());
  },
  async reauthenticate(actor, password) {
    try {
      need(actor, 'roles.change');
      const rt = adminRuntime();
      await rt.auth().staff.reauthenticate(staffActor(actor), password, await rt.meta());
      return OK;
    } catch (error) {
      return staffFailure(error);
    }
  },

  async resetTwoFactor(actor, staffId, code) {
    try {
      need(actor, 'roles.change');
      const rt = adminRuntime();
      await rt
        .auth()
        .staff.resetTwoFactor(staffActor(actor), { accountId: staffId, code }, await rt.meta());
      return OK;
    } catch (error) {
      return staffFailure(error);
    }
  },

  async invite(actor, email, role) {
    try {
      need(actor, 'roles.change');
      const rt = adminRuntime();
      await rt.auth().staff.createInvite(staffActor(actor), { email, role }, await rt.meta());
      return OK;
    } catch (error) {
      return inviteMailFailure(error);
    }
  },

  async resendInvite(actor, id) {
    try {
      need(actor, 'roles.change');
      const rt = adminRuntime();
      const who = staffActor(actor);
      const invite = (await rt.auth().staff.listInvites(who)).find((i) => i.id === id);
      if (!invite) return fail('That invite is no longer pending.');
      await rt
        .auth()
        .staff.createInvite(who, { email: invite.email, role: invite.role }, await rt.meta());
      return OK;
    } catch (error) {
      return inviteMailFailure(error);
    }
  },

  async revokeInvite(actor, id) {
    try {
      need(actor, 'roles.change');
      const rt = adminRuntime();
      const who = staffActor(actor);
      if (!(await rt.auth().staff.listInvites(who)).some((i) => i.id === id))
        return fail('That invite is no longer pending.');
      await rt.auth().staff.revokeInvite(who, id, await rt.meta());
      return OK;
    } catch (error) {
      return staffFailure(error);
    }
  },

  async deleteAccount(actor, id, confirmation) {
    try {
      need(actor, 'users.delete');
      const rt = adminRuntime();
      const [current] = await loadUsers(catalogActor(actor), eq(schema.accounts.id, id));
      if (!current) return fail(NOT_FOUND);
      await rt
        .auth()
        .staff.deleteViewerAccount(
          staffActor(actor),
          { accountId: id, confirmation },
          await rt.meta(),
        );
      return OK;
    } catch (error) {
      return staffFailure(error);
    }
  },

  async changeRole(actor, staffId, role) {
    try {
      need(actor, 'roles.change');
      const rt = adminRuntime();
      const who = staffActor(actor);
      const current = (await rt.auth().staff.listStaff(who)).find((m) => m.accountId === staffId);
      if (!current) return fail('That person was not found.');
      if (current.role === role) return OK;
      await rt
        .auth()
        .staff.changeRole(
          who,
          { accountId: staffId, role, expectedRole: current.role },
          await rt.meta(),
        );
      return OK;
    } catch (error) {
      return staffFailure(error);
    }
  },
};
