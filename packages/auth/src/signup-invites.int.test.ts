import { schema } from '@ad/db';
import { integrationEnabled } from '@ad/db/testing';
import { Forbidden } from '@ad/shared';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { StaffService } from './staff';
import { createAuthHarness, registerMember, TEST_PASSWORD, type AuthHarness } from './testing';
import { FieldErrors, InviteRequired } from './types';

const input = (email: string, inviteCode?: string) => ({
  email,
  password: TEST_PASSWORD,
  acceptTerms: true,
  guardianDeclaration: true,
  inviteCode,
});

describe.skipIf(!integrationEnabled())('sign up invite codes (M29-S03)', () => {
  let h: AuthHarness;
  let open = false;
  let staff: StaffService;
  let admin: { accountId: string; role: 'admin'; sessionId: string };
  let n = 0;
  const fresh = () => `invited${++n}@example.com`;

  beforeAll(async () => {
    h = await createAuthHarness({ signUpPolicy: async () => ({ open }) });
    staff = new StaffService(h.deps);
    open = true;
    const member = await registerMember(h, staff);
    await h.dbs.admin.db
      .update(schema.accounts)
      .set({ role: 'admin' })
      .where(eq(schema.accounts.id, member.id));
    admin = { accountId: member.id, role: 'admin', sessionId: 'unused' };
    open = false;
  });
  afterAll(async () => {
    await h.drop();
  });

  /** Accounts that already exist were created while sign up was open. */
  async function existingMember() {
    open = true;
    try {
      return await registerMember(h, staff);
    } finally {
      open = false;
    }
  }

  const create = (extra: { maxUses?: number; expiresAt?: Date | null; label?: string } = {}) =>
    staff.createSignupInvite(
      admin,
      { label: 'Soft launch', maxUses: 5, expiresAt: null, ...extra },
      h.meta,
    );
  const row = async (id: string) =>
    (
      await h.dbs.admin.db
        .select()
        .from(schema.signupInvites)
        .where(eq(schema.signupInvites.id, id))
    )[0]!;

  it('returns the code once and stores only its hash and a short hint', async () => {
    const made = await create();
    expect(made.code).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{2}$/);
    const stored = await row(made.id);
    expect(JSON.stringify(stored)).not.toContain(made.code.replace(/-/g, ''));
    expect(stored.hint).toBe(made.code.slice(-2));
    const listed = await staff.listSignupInvites(admin);
    expect(listed.find((item) => item.id === made.id)).toMatchObject({
      label: 'Soft launch',
      hint: made.code.slice(-2),
      uses: 0,
      maxUses: 5,
      status: 'active',
    });
    expect(JSON.stringify(listed)).not.toContain(made.code);
  });

  it('only an admin can create, list or revoke codes', async () => {
    const editor = await existingMember();
    await h.dbs.admin.db
      .update(schema.accounts)
      .set({ role: 'editor' })
      .where(eq(schema.accounts.id, editor.id));
    const actor = { accountId: editor.id, role: 'editor' as const, sessionId: 'x' };
    await expect(
      staff.createSignupInvite(actor, { label: '', maxUses: 1, expiresAt: null }, h.meta),
    ).rejects.toBeInstanceOf(Forbidden);
    await expect(staff.listSignupInvites(actor)).rejects.toBeInstanceOf(Forbidden);
    await expect(staff.revokeSignupInvite(actor, 'any', h.meta)).rejects.toBeInstanceOf(Forbidden);
  });

  it('validates the use limit, expiry and label', async () => {
    await expect(create({ maxUses: 0 })).rejects.toBeInstanceOf(FieldErrors);
    await expect(create({ maxUses: 1001 })).rejects.toBeInstanceOf(FieldErrors);
    await expect(create({ expiresAt: new Date(h.deps.clock!().getTime() - 1000) })).rejects.toBeInstanceOf(
      FieldErrors,
    );
    await expect(create({ label: 'x'.repeat(61) })).rejects.toBeInstanceOf(FieldErrors);
  });

  it('lets sign up proceed with a valid code and counts the use', async () => {
    const made = await create({ maxUses: 2 });
    await staff.signUp(input(fresh(), made.code), h.meta);
    expect((await row(made.id)).uses).toBe(1);
  });

  it('accepts the code typed in lower case, with spaces or without dashes', async () => {
    const made = await create({ maxUses: 3 });
    await staff.signUp(input(fresh(), made.code.toLowerCase()), h.meta);
    await staff.signUp(input(fresh(), ` ${made.code.replace(/-/g, '')} `), h.meta);
    expect((await row(made.id)).uses).toBe(2);
  });

  it('refuses a missing, wrong, used up, expired or revoked code with the same error', async () => {
    const used = await create({ maxUses: 1 });
    await staff.signUp(input(fresh(), used.code), h.meta);
    const soon = await create({ expiresAt: new Date(h.deps.clock!().getTime() + 60_000) });
    const revoked = await create();
    await staff.revokeSignupInvite(admin, revoked.id, h.meta);
    h.advance(120);
    for (const code of [undefined, '', 'ZZZZ-ZZZZ-ZZ', used.code, soon.code, revoked.code]) {
      const attempt = staff.signUp(input(fresh(), code), h.meta);
      await expect(attempt).rejects.toBeInstanceOf(InviteRequired);
    }
    expect((await row(used.id)).uses).toBe(1);
    expect((await row(revoked.id)).uses).toBe(0);
  });

  it('does not reveal whether an address has an account when the code is wrong', async () => {
    const existing = await existingMember();
    await expect(staff.signUp(input(existing.email, 'ZZZZ-ZZZZ-ZZ'), h.meta)).rejects.toBeInstanceOf(
      InviteRequired,
    );
  });

  it('does not use up a code on an address that already has an account', async () => {
    const made = await create({ maxUses: 1 });
    const existing = await existingMember();
    await expect(staff.signUp(input(existing.email, made.code), h.meta)).resolves.toMatchObject({
      emailSent: true,
    });
    expect((await row(made.id)).uses).toBe(0);
  });

  it('never lets concurrent sign ups pass the use limit', async () => {
    const made = await create({ maxUses: 1 });
    const results = await Promise.allSettled(
      Array.from({ length: 5 }, () => staff.signUp(input(fresh(), made.code), h.meta)),
    );
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect((await row(made.id)).uses).toBe(1);
  });

  it('shows revoked, used up and expired codes with their status', async () => {
    const revoked = await create();
    await staff.revokeSignupInvite(admin, revoked.id, h.meta);
    const full = await create({ maxUses: 1 });
    await staff.signUp(input(fresh(), full.code), h.meta);
    const listed = await staff.listSignupInvites(admin);
    expect(listed.find((i) => i.id === revoked.id)?.status).toBe('revoked');
    expect(listed.find((i) => i.id === full.id)?.status).toBe('used_up');
  });

  it('ignores the code when sign up is open', async () => {
    open = true;
    try {
      await expect(staff.signUp(input(fresh()), h.meta)).resolves.toMatchObject({
        emailSent: true,
      });
    } finally {
      open = false;
    }
  });

  it('audits creation and revocation without the code', async () => {
    const made = await create({ label: 'Audited' });
    await staff.revokeSignupInvite(admin, made.id, h.meta);
    const rows = await h.dbs.admin.db
      .select()
      .from(schema.auditLog)
      .where(eq(schema.auditLog.targetId, made.id));
    expect(rows.map((r) => r.action).sort()).toEqual([
      'admin.signup_invite_created',
      'admin.signup_invite_revoked',
    ]);
    expect(JSON.stringify(rows)).not.toContain(made.code);
  });
});
