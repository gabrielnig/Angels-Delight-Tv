import { beforeEach, describe, expect, it } from 'vitest';
import { inviteCodesAdmin, resetInviteCodeFixture } from './invite-codes';
import type { AdminActor } from './types';

const admin: AdminActor = { accountId: 'a1', role: 'admin', name: 'Sister Vanessa' };
const editor: AdminActor = { accountId: 'e1', role: 'editor', name: 'Editor' };

describe('invite codes fixture service', () => {
  beforeEach(() => resetInviteCodeFixture());

  it('starts empty', async () => {
    expect(await inviteCodesAdmin.list(admin)).toEqual([]);
  });

  it('creates a code, hides it afterwards and counts it as active', async () => {
    const result = await inviteCodesAdmin.create(admin, { label: 'Pilot', maxUses: 2, expiresAt: null });
    if (!result.ok) throw new Error(result.error);
    expect(result.code).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{2}$/);
    expect(result.invites).toHaveLength(1);
    expect(JSON.stringify(await inviteCodesAdmin.list(admin))).not.toContain(result.code!);
  });

  it('rejects a bad limit and a past expiry', async () => {
    expect((await inviteCodesAdmin.create(admin, { label: '', maxUses: 0, expiresAt: null })).ok).toBe(false);
    expect(
      (await inviteCodesAdmin.create(admin, { label: '', maxUses: 1, expiresAt: '2020-01-01T00:00:00Z' })).ok,
    ).toBe(false);
  });

  it('revokes a code and refuses an unknown one', async () => {
    const made = await inviteCodesAdmin.create(admin, { label: 'x', maxUses: 1, expiresAt: null });
    if (!made.ok) throw new Error(made.error);
    const id = made.invites[0]!.id;
    const revoked = await inviteCodesAdmin.revoke(admin, id);
    expect(revoked.ok && revoked.invites[0]?.status).toBe('revoked');
    expect(await inviteCodesAdmin.revoke(admin, 'nope')).toEqual({
      ok: false,
      error: 'That code no longer exists.',
    });
  });

  it('refuses editors', async () => {
    expect((await inviteCodesAdmin.create(editor, { label: '', maxUses: 1, expiresAt: null })).ok).toBe(false);
    await expect(inviteCodesAdmin.list(editor)).rejects.toThrow();
  });
});
