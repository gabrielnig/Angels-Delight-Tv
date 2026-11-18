import { describe, expect, it } from 'vitest';
import {
  changeRole,
  filterUsers,
  inviteStaff,
  maskEmail,
  reinstateUser,
  resendInvite,
  revokeInvite,
  revokeSessions,
  suspendUser,
} from './users-commands';
import { getStore } from './store';

const fresh = () => structuredClone(getStore());
const NOW = Date.parse('2026-11-17T10:00:00Z');

describe('maskEmail', () => {
  it('hides most of the name', () => {
    expect(maskEmail('ngozi@example.test')).toBe('n***@example.test');
    expect(maskEmail('bad')).toBe('***');
  });
});

describe('users', () => {
  it('suspends with a reason, audits it and revokes sessions', () => {
    const s = fresh();
    const id = s.users[0]!.id;
    expect(suspendUser(s, id, '', 'a1', 'Chiamaka', NOW).ok).toBe(false);
    expect(suspendUser(s, id, 'Reported abuse', 'a1', 'Chiamaka', NOW).ok).toBe(true);
    const u = s.users[0]!;
    expect(u).toMatchObject({
      status: 'suspended',
      sessions: 0,
      suspendedReason: 'Reported abuse',
    });
    expect(s.audit[0]).toMatchObject({ action: 'user.suspend', targetId: id, outcome: 'success' });
  });
  it('reinstates', () => {
    const s = fresh();
    const id = s.users[0]!.id;
    suspendUser(s, id, 'Reported abuse', 'a1', 'C', NOW);
    expect(reinstateUser(s, id, 'a1', 'C', NOW).ok).toBe(true);
    expect(s.users[0]!.status).toBe('active');
  });
  it('revokes sessions with a reason', () => {
    const s = fresh();
    const id = s.users.find((u) => u.sessions > 0)!.id;
    expect(revokeSessions(s, id, 'x', 'a1', 'C', NOW).ok).toBe(false);
    expect(revokeSessions(s, id, 'Lost phone', 'a1', 'C', NOW).ok).toBe(true);
    expect(s.users.find((u) => u.id === id)!.sessions).toBe(0);
  });
  it('filters by text and status', () => {
    const s = fresh();
    suspendUser(s, s.users[0]!.id, 'Reported abuse', 'a1', 'C', NOW);
    expect(filterUsers(s.users, { status: 'suspended' })).toHaveLength(2);
    expect(filterUsers(s.users, { q: 'NO-SUCH' })).toHaveLength(0);
  });
});

describe('invites', () => {
  it('invites with a 7 day expiry', () => {
    const s = fresh();
    const r = inviteStaff(s, ' New@Example.test ', 'editor', 'a1', 'C', NOW);
    expect(r.ok).toBe(true);
    const inv = s.invites.at(-1)!;
    expect(inv.email).toBe('new@example.test');
    expect(Date.parse(inv.expiresAt) - NOW).toBe(7 * 86400000);
  });
  it('rejects bad, staff and duplicate emails', () => {
    const s = fresh();
    expect(inviteStaff(s, 'nope', 'editor', 'a1', 'C', NOW).ok).toBe(false);
    expect(inviteStaff(s, s.staff[0]!.email, 'editor', 'a1', 'C', NOW).ok).toBe(false);
    inviteStaff(s, 'dup@example.test', 'editor', 'a1', 'C', NOW);
    expect(inviteStaff(s, 'dup@example.test', 'admin', 'a1', 'C', NOW).ok).toBe(false);
  });
  it('resends and revokes', () => {
    const s = fresh();
    inviteStaff(s, 'x@example.test', 'editor', 'a1', 'C', NOW);
    const id = s.invites.at(-1)!.id;
    expect(resendInvite(s, id, 'a1', 'C', NOW + 86400000).ok).toBe(true);
    expect(Date.parse(s.invites.at(-1)!.expiresAt)).toBe(NOW + 86400000 + 7 * 86400000);
    expect(revokeInvite(s, id, 'a1', 'C', NOW).ok).toBe(true);
    expect(s.invites.some((i) => i.id === id)).toBe(false);
  });
});

describe('roles', () => {
  it('changes a role and audits before and after', () => {
    const s = fresh();
    const editor = s.staff.find((x) => x.role === 'editor')!;
    expect(changeRole(s, editor.id, 'admin', 'a1', 'C', NOW).ok).toBe(true);
    expect(s.audit[0]).toMatchObject({
      action: 'role.change',
      before: { role: 'editor' },
      after: { role: 'admin' },
    });
  });
  it('keeps at least one Super admin', () => {
    const s = fresh();
    const supers = s.staff.filter((x) => x.role === 'super_admin');
    expect(supers.length).toBeGreaterThan(0);
    const r = changeRole(s, supers[0]!.id, 'admin', 'someone-else', 'C', NOW);
    expect(r).toEqual({ ok: false, error: 'There must be at least one Super admin' });
    expect(supers[0]!.role).toBe('super_admin');
  });

  it('refuses a change to your own role', () => {
    const s = fresh();
    const supers = s.staff.filter((x) => x.role === 'super_admin');
    const extra = changeRole(
      s,
      s.staff.find((x) => x.role === 'admin')!.id,
      'super_admin',
      'x',
      'C',
      NOW,
    );
    expect(extra.ok).toBe(true);
    const r = changeRole(s, supers[0]!.id, 'admin', supers[0]!.id, 'C', NOW);
    expect(r).toEqual({ ok: false, error: 'You cannot change your own role.' });
  });

  it('lets a Super admin be invited', () => {
    const s = fresh();
    expect(inviteStaff(s, 'boss@example.test', 'super_admin', 'a1', 'C', NOW).ok).toBe(true);
    expect(inviteStaff(s, 'nope@example.test', 'owner' as never, 'a1', 'C', NOW).ok).toBe(false);
  });
});
