import { describe, expect, it } from 'vitest';
import { MAX_RESEND_BULK, runStaffBulk, type StaffBulkService } from './staff-bulk';
import { getStore } from './store';
import { changeRole, resendInvite } from './users-commands';

const NOW = Date.parse('2026-11-17T10:00:00Z');

function setup() {
  const s = structuredClone(getStore());
  const service: StaffBulkService = {
    async staff() {
      return s.staff.map((m) => ({ id: m.id, role: m.role }));
    },
    async invites() {
      return s.invites.map((i) => ({ id: i.id, createdAt: i.createdAt }));
    },
    async changeRole(id, role) {
      return changeRole(s, id, role, 'acc_arkdev', 'Arkdev', NOW);
    },
    async resend(id) {
      return resendInvite(s, id, 'acc_arkdev', 'Arkdev', NOW);
    },
  };
  return { s, service };
}
const role = (s: ReturnType<typeof setup>['s'], id: string) => s.staff.find((m) => m.id === id)!.role;

describe('runStaffBulk role change', () => {
  it('moves editors and admins between Editor and Admin and audits old and new role', async () => {
    const { s, service } = setup();
    const out = await runStaffBulk(service, 'acc_arkdev', ['stf_2', 'stf_3'], { type: 'role', role: 'admin' }, 'b', NOW);
    expect(out.succeeded).toEqual(['stf_2', 'stf_3']);
    expect(role(s, 'stf_2')).toBe('admin');
    const rows = s.audit.filter((a) => a.action === 'role.change');
    expect(rows[0]).toMatchObject({ before: { role: 'editor' }, after: { role: 'admin' } });
    expect(out.undo).toBeUndefined();
  });

  it('refuses a batch that includes the actor', async () => {
    const { s, service } = setup();
    const out = await runStaffBulk(service, 'stf_1', ['stf_1', 'stf_2'], { type: 'role', role: 'editor' }, 'b', NOW);
    expect(out.succeeded).toEqual([]);
    expect(out.failed.map((f) => f.reason)).toEqual([
      'You cannot change your own role.',
      'You cannot change your own role.',
    ]);
    expect(role(s, 'stf_2')).toBe('editor');
  });

  it('refuses moving anyone to or from Super admin', async () => {
    const { s, service } = setup();
    const to = await runStaffBulk(service, 'acc_arkdev', ['stf_2'], { type: 'role', role: 'super_admin' as never }, 'b', NOW);
    expect(to.failed[0]!.reason).toBe('Moving anyone to or from Super admin is done one at a time.');
    s.staff.push({ id: 'stf_boss', name: 'Boss', email: 'b@example.test', role: 'super_admin', twoFactor: true, lastSignInAt: null });
    const from = await runStaffBulk(service, 'acc_arkdev', ['stf_boss', 'stf_2'], { type: 'role', role: 'admin' }, 'b', NOW);
    expect(from.succeeded).toEqual([]);
    expect(from.failed.every((f) => f.reason.startsWith('Moving anyone'))).toBe(true);
    expect(role(s, 'stf_boss')).toBe('super_admin');
  });

  it('skips someone who already has the role and reports unknown ids', async () => {
    const { service } = setup();
    const out = await runStaffBulk(service, 'acc_arkdev', ['stf_1', 'nope'], { type: 'role', role: 'admin' }, 'b', NOW);
    expect(out.skipped).toEqual([{ id: 'stf_1', reason: 'Already an Admin.' }]);
    expect(out.failed).toEqual([{ id: 'nope', reason: 'That person was not found.', retryable: false }]);
  });
});

describe('runStaffBulk resend invites', () => {
  it('skips invites sent in the last hour and ones that are gone, resends the rest', async () => {
    const { s, service } = setup();
    s.invites[0]!.createdAt = new Date(NOW - 10 * 60_000).toISOString();
    const out = await runStaffBulk(service, 'acc_arkdev', ['inv_1', 'inv_2', 'inv_gone'], { type: 'resend_invites' }, 'b', NOW);
    expect(out.succeeded).toEqual(['inv_2']);
    expect(out.skipped).toEqual([
      { id: 'inv_1', reason: 'Sent less than an hour ago.' },
      { id: 'inv_gone', reason: 'That invite is no longer pending.' },
    ]);
  });

  it('caps at 20 per batch', async () => {
    const { service } = setup();
    const ids = Array.from({ length: MAX_RESEND_BULK + 1 }, (_, i) => `inv_${i}`);
    const out = await runStaffBulk(service, 'acc_arkdev', ids, { type: 'resend_invites' }, 'b', NOW);
    expect(out.succeeded).toEqual([]);
    expect(out.failed[0]!.reason).toBe('Choose 20 invites or fewer at a time.');
  });
});
