import { StaffService } from '@ad/auth';
import { createAuthHarness, registerMember, type AuthHarness } from '@ad/auth/testing';
import { schema } from '@ad/db';
import { integrationEnabled } from '@ad/db/testing';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setAdminRuntime } from '@/server/admin/runtime';
import type { AdminActor } from '../types';
import { realInviteCodes } from './invite-codes';

describe.skipIf(!integrationEnabled())('real invite codes service', () => {
  let h: AuthHarness;
  let admin: AdminActor;
  let editor: AdminActor;

  async function staffActor(role: 'editor' | 'admin'): Promise<AdminActor> {
    const member = await registerMember(h, new StaffService(h.deps), {
      email: `${role}.${Math.random().toString(36).slice(2, 7)}@example.org`,
    });
    await h.dbs.admin.db
      .update(schema.accounts)
      .set({ role })
      .where(eq(schema.accounts.id, member.id));
    return { accountId: member.id, role, name: 'Test Staff', sessionId: 'unused' };
  }

  beforeAll(async () => {
    h = await createAuthHarness();
    const staff = new StaffService(h.deps);
    setAdminRuntime({
      db: () => h.dbs.app.db,
      auth: () => ({ staff, sessions: h.deps.sessions, keys: h.deps.keys }),
      meta: async () => h.meta,
      now: () => h.deps.clock!(),
    });
    admin = await staffActor('admin');
    editor = await staffActor('editor');
  });
  afterAll(async () => {
    setAdminRuntime(null);
    await h?.drop();
  });

  const input = { label: 'Soft launch', maxUses: 3, expiresAt: null };

  it('creates a code, returns it once and lists it without the code', async () => {
    const result = await realInviteCodes.create(admin, input);
    if (!result.ok) throw new Error(result.error);
    expect(result.code).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{2}$/);
    expect(result.invites[0]).toMatchObject({
      label: 'Soft launch',
      maxUses: 3,
      uses: 0,
      status: 'active',
    });
    expect(JSON.stringify(await realInviteCodes.list(admin))).not.toContain(result.code!);
  });

  it('revokes a code and shows it as revoked', async () => {
    const made = await realInviteCodes.create(admin, { ...input, label: 'To revoke' });
    if (!made.ok) throw new Error(made.error);
    const id = made.invites.find((i) => i.label === 'To revoke')!.id;
    const result = await realInviteCodes.revoke(admin, id);
    if (!result.ok) throw new Error(result.error);
    expect(result.invites.find((i) => i.id === id)?.status).toBe('revoked');
  });

  it('turns validation problems into a plain message', async () => {
    expect(await realInviteCodes.create(admin, { ...input, maxUses: 0 })).toEqual({
      ok: false,
      error: 'Use a number from 1 to 1000',
    });
    expect(
      await realInviteCodes.create(admin, { ...input, expiresAt: '2020-01-01T00:00:00Z' }),
    ).toEqual({ ok: false, error: 'Choose a date in the future' });
  });

  it('is closed to editors', async () => {
    expect((await realInviteCodes.create(editor, input)).ok).toBe(false);
    await expect(realInviteCodes.list(editor)).rejects.toThrow();
  });

  it('reports a missing code on revoke', async () => {
    expect(await realInviteCodes.revoke(admin, '0194d3c0-0000-7000-8000-000000000099')).toEqual({
      ok: false,
      error: 'That code no longer exists.',
    });
  });
});
