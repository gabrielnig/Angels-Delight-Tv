import { describe, expect, it } from 'vitest';
import { planUserUndo, runUserBulk, MAX_USER_BULK, type UserBulkService } from './user-bulk';
import { getStore } from './store';
import { reinstateUser, revokeSessions, suspendUser } from './users-commands';

const NOW = Date.parse('2026-11-17T10:00:00Z');

function setup() {
  const s = structuredClone(getStore());
  const audit = (n: string) => s.audit.filter((a) => a.action === n).length;
  const service: UserBulkService = {
    async list() {
      return s.users.map((u) => ({ id: u.id, status: u.status, suspendedReason: u.suspendedReason }));
    },
    async suspend(id, reason) {
      return suspendUser(s, id, reason, 'a1', 'Chiamaka', NOW);
    },
    async reinstate(id) {
      return reinstateUser(s, id, 'a1', 'Chiamaka', NOW);
    },
    async signOut(id, reason) {
      return revokeSessions(s, id, reason, 'a1', 'Chiamaka', NOW);
    },
  };
  const active = s.users.filter((u) => u.status === 'active').map((u) => u.id);
  return { s, service, active, audit };
}

describe('runUserBulk', () => {
  it('suspend needs a reason of 3 or more characters and changes nothing without one', async () => {
    const { s, service, active } = setup();
    const out = await runUserBulk(service, 'me', [active[0]!], { type: 'suspend', reason: 'ab' }, 'b');
    expect(out.succeeded).toEqual([]);
    expect(out.failed[0]).toMatchObject({ id: active[0], retryable: false });
    expect(out.failed[0]!.reason).toMatch(/reason/);
    expect(s.users.find((u) => u.id === active[0])!.status).toBe('active');
  });

  it('the acting account is skipped even when included', async () => {
    const { s, service, active } = setup();
    const out = await runUserBulk(service, active[0]!, active.slice(0, 2), { type: 'suspend', reason: 'Abuse reports' }, 'b');
    expect(out.skipped).toEqual([{ id: active[0], reason: 'You cannot do this to your own account.' }]);
    expect(out.succeeded).toEqual([active[1]]);
    expect(s.users.find((u) => u.id === active[0])!.status).toBe('active');
  });

  it('already suspended and already active accounts are skipped', async () => {
    const { s, service, active } = setup();
    suspendUser(s, active[0]!, 'earlier', 'a1', 'C', NOW);
    const out = await runUserBulk(service, 'me', [active[0]!, active[1]!], { type: 'suspend', reason: 'Abuse reports' }, 'b');
    expect(out.skipped).toEqual([{ id: active[0], reason: 'Already suspended.' }]);
    const back = await runUserBulk(service, 'me', [active[1]!, active[2]!], { type: 'reinstate' }, 'b');
    expect(back.skipped).toEqual([{ id: active[2], reason: 'Already active.' }]);
    expect(back.succeeded).toEqual([active[1]]);
  });

  it('force sign out ends sessions for each and audits each', async () => {
    const { service, active, audit } = setup();
    const before = audit('session.revoke_all');
    const out = await runUserBulk(service, 'me', active.slice(0, 2), { type: 'sign_out', reason: 'Lost phone' }, 'b');
    expect(out.succeeded).toEqual(active.slice(0, 2));
    expect(audit('session.revoke_all')).toBe(before + 2);
    expect(out.undo).toBeUndefined();
  });

  it('more than 50 ids are refused', async () => {
    const { service } = setup();
    const ids = Array.from({ length: MAX_USER_BULK + 1 }, (_, i) => `u${i}`);
    const out = await runUserBulk(service, 'me', ids, { type: 'reinstate' }, 'b');
    expect(out.succeeded).toEqual([]);
    expect(out.failed).toHaveLength(MAX_USER_BULK + 1);
    expect(out.failed[0]!.reason).toBe('Choose 50 accounts or fewer at a time.');
  });

  it('suspend undo reinstates only accounts still suspended, and reinstate undo restores each reason', async () => {
    const { s, service, active } = setup();
    const ids = [active[0]!, active[1]!];
    const out = await runUserBulk(service, 'me', ids, { type: 'suspend', reason: 'Abuse reports' }, 'b');
    expect(planUserUndo(out.undo!, { [ids[0]!]: 'suspended', [ids[1]!]: 'active' })).toEqual([
      { type: 'reinstate', ids: [ids[0]] },
    ]);
    const back = await runUserBulk(service, 'me', ids, { type: 'reinstate' }, 'b2');
    const steps = planUserUndo(back.undo!, { [ids[0]!]: 'active', [ids[1]!]: 'active' });
    expect(steps).toEqual([{ type: 'suspend', reason: 'Abuse reports', ids }]);
    expect(s.users.find((u) => u.id === ids[0])!.status).toBe('active');
  });
});
