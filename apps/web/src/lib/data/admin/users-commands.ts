import type { AdminStore } from './store';
import type { AuditRow } from './types';
import type { CommandResult } from './video-commands';

const fail = (error: string): CommandResult => ({ ok: false, error });
const OK: CommandResult = { ok: true };
const DAY = 86_400_000;
export const INVITE_DAYS = 7;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export type StaffRoleName = 'editor' | 'admin' | 'super_admin';
export const STAFF_ROLES: readonly StaffRoleName[] = ['editor', 'admin', 'super_admin'];

export function maskEmail(email: string): string {
  const at = email.indexOf('@');
  if (at < 1) return '***';
  return `${email[0]}***${email.slice(at)}`;
}

export function pushAudit(
  s: AdminStore,
  entry: Pick<AuditRow, 'action' | 'targetType' | 'targetId' | 'summary'> &
    Partial<Pick<AuditRow, 'before' | 'after' | 'outcome'>>,
  actorId: string,
  actorName: string,
  now: number,
) {
  const id = (s.audit[0]?.id ?? 0) + 1;
  s.audit.unshift({
    id,
    at: new Date(now).toISOString(),
    actorId,
    actorName,
    actorRole: 'admin',
    outcome: 'success',
    before: null,
    after: null,
    ip: '102.89.x.x',
    requestId: `req_${id.toString(36)}`,
    ...entry,
  });
}

const reasonOk = (reason: string) => reason.trim().length >= 3;

export function suspendUser(
  s: AdminStore,
  id: string,
  reason: string,
  actorId: string,
  actorName: string,
  now: number,
): CommandResult {
  const user = s.users.find((u) => u.id === id);
  if (!user) return fail('User not found.');
  if (!reasonOk(reason)) return fail('Write a short reason. It is kept in the audit log.');
  if (user.status === 'suspended') return fail('This account is already suspended.');
  user.status = 'suspended';
  user.sessions = 0;
  user.suspendedReason = reason.trim().slice(0, 200);
  pushAudit(
    s,
    {
      action: 'user.suspend',
      targetType: 'user',
      targetId: id,
      summary: `Suspended ${maskEmail(user.email)}`,
      before: { status: 'active' },
      after: { status: 'suspended', reason: user.suspendedReason },
    },
    actorId,
    actorName,
    now,
  );
  return OK;
}

export function reinstateUser(
  s: AdminStore,
  id: string,
  actorId: string,
  actorName: string,
  now: number,
): CommandResult {
  const user = s.users.find((u) => u.id === id);
  if (!user) return fail('User not found.');
  if (user.status === 'active') return fail('This account is already active.');
  user.status = 'active';
  user.suspendedReason = null;
  pushAudit(
    s,
    {
      action: 'user.reinstate',
      targetType: 'user',
      targetId: id,
      summary: `Reinstated ${maskEmail(user.email)}`,
      before: { status: 'suspended' },
      after: { status: 'active' },
    },
    actorId,
    actorName,
    now,
  );
  return OK;
}

export function revokeSessions(
  s: AdminStore,
  id: string,
  reason: string,
  actorId: string,
  actorName: string,
  now: number,
): CommandResult {
  const user = s.users.find((u) => u.id === id);
  if (!user) return fail('User not found.');
  if (!reasonOk(reason)) return fail('Write a short reason. It is kept in the audit log.');
  const count = user.sessions;
  user.sessions = 0;
  pushAudit(
    s,
    {
      action: 'session.revoke_all',
      targetType: 'user',
      targetId: id,
      summary: `Signed ${maskEmail(user.email)} out of ${count} sessions`,
      before: { sessions: count },
      after: { sessions: 0 },
    },
    actorId,
    actorName,
    now,
  );
  return OK;
}

export function deleteUserAccount(
  s: AdminStore,
  id: string,
  confirmation: string,
  actorId: string,
  actorName: string,
  now: number,
): CommandResult {
  if (confirmation !== 'DELETE') return fail('Type DELETE in capital letters to confirm.');
  if (id === actorId) return fail('You cannot delete your own account here.');
  const user = s.users.find((u) => u.id === id);
  if (!user) return fail('User not found.');
  s.users = s.users.filter((u) => u.id !== id);
  pushAudit(
    s,
    {
      action: 'user.delete_requested',
      targetType: 'user',
      targetId: id,
      summary: `Started deleting ${maskEmail(user.email)} at their request`,
    },
    actorId,
    actorName,
    now,
  );
  return OK;
}

export function filterUsers(
  users: AdminStore['users'],
  query: { q?: string; status?: 'active' | 'suspended' | '' },
) {
  const q = (query.q ?? '').trim().toLowerCase();
  return users.filter(
    (u) =>
      (!query.status || u.status === query.status) &&
      (!q ||
        u.email.toLowerCase().includes(q) ||
        u.profiles.some((p) => p.name.toLowerCase().includes(q))),
  );
}

export function inviteStaff(
  s: AdminStore,
  rawEmail: string,
  role: StaffRoleName,
  actorId: string,
  actorName: string,
  now: number,
): CommandResult {
  const email = rawEmail.trim().toLowerCase();
  if (!EMAIL.test(email)) return fail('Enter a full email address, like name@example.com.');
  if (!STAFF_ROLES.includes(role)) return fail('Choose a role.');
  if (s.staff.some((m) => m.email === email)) return fail('That person already has admin access.');
  if (s.invites.some((i) => i.email === email))
    return fail('That person already has a pending invite. Resend it instead.');
  const id = `inv_${now.toString(36)}${s.invites.length}`;
  s.invites.push({
    id,
    email,
    role,
    invitedBy: actorName,
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + INVITE_DAYS * DAY).toISOString(),
  });
  pushAudit(
    s,
    {
      action: 'staff.invite',
      targetType: 'invite',
      targetId: id,
      summary: `Invited ${email} as ${role}`,
      after: { email, role },
    },
    actorId,
    actorName,
    now,
  );
  return OK;
}

export function resendInvite(
  s: AdminStore,
  id: string,
  actorId: string,
  actorName: string,
  now: number,
): CommandResult {
  const invite = s.invites.find((i) => i.id === id);
  if (!invite) return fail('Invite not found.');
  invite.expiresAt = new Date(now + INVITE_DAYS * DAY).toISOString();
  pushAudit(
    s,
    {
      action: 'staff.invite_resend',
      targetType: 'invite',
      targetId: id,
      summary: `Resent the invite to ${invite.email}`,
    },
    actorId,
    actorName,
    now,
  );
  return OK;
}

export function revokeInvite(
  s: AdminStore,
  id: string,
  actorId: string,
  actorName: string,
  now: number,
): CommandResult {
  const invite = s.invites.find((i) => i.id === id);
  if (!invite) return fail('Invite not found.');
  s.invites = s.invites.filter((i) => i.id !== id);
  pushAudit(
    s,
    {
      action: 'staff.invite_revoke',
      targetType: 'invite',
      targetId: id,
      summary: `Cancelled the invite to ${invite.email}`,
    },
    actorId,
    actorName,
    now,
  );
  return OK;
}

export function changeRole(
  s: AdminStore,
  staffId: string,
  role: StaffRoleName,
  actorId: string,
  actorName: string,
  now: number,
): CommandResult {
  const member = s.staff.find((m) => m.id === staffId);
  if (!member) return fail('Person not found.');
  if (!STAFF_ROLES.includes(role)) return fail('Choose a role.');
  if (member.id === actorId) return fail('You cannot change your own role.');
  if (member.role === role) return OK;
  if (member.role === 'super_admin' && s.staff.filter((m) => m.role === 'super_admin').length <= 1)
    return fail('There must be at least one Super admin');
  const before = member.role;
  member.role = role;
  pushAudit(
    s,
    {
      action: 'role.change',
      targetType: 'staff',
      targetId: staffId,
      summary: `Changed ${member.name} from ${before} to ${role}`,
      before: { role: before },
      after: { role },
    },
    actorId,
    actorName,
    now,
  );
  return OK;
}
