import { StaffService } from '@ad/auth';
import { createAuthHarness, registerMember, type AuthHarness } from '@ad/auth/testing';
import { schema } from '@ad/db';
import { integrationEnabled } from '@ad/db/testing';
import { openAddress } from '@ad/queue';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { setAdminRuntime } from '@/server/admin/runtime';
import type { AdminActor } from '../types';

vi.mock('server-only', () => ({}));
const { realNotices } = await import('./notices');

describe.skipIf(!integrationEnabled())('real notification choices and the saved address', () => {
  let h: AuthHarness;
  let staff: StaffService;

  async function person(role: 'editor' | 'admin') {
    const member = await registerMember(h, staff, {
      email: `${role}.${Math.random().toString(36).slice(2, 7)}@example.org`,
    });
    await h.dbs.admin.db
      .update(schema.accounts)
      .set({ role })
      .where(eq(schema.accounts.id, member.id));
    const actor: AdminActor = { accountId: member.id, role, name: 'Someone' };
    return { member, actor };
  }
  const stored = async (accountId: string) =>
    (
      await h.dbs.admin.db
        .select()
        .from(schema.staffNotificationPrefs)
        .where(eq(schema.staffNotificationPrefs.accountId, accountId))
    )[0];

  beforeAll(async () => {
    h = await createAuthHarness();
    staff = new StaffService(h.deps);
    setAdminRuntime({
      db: () => h.dbs.app.db,
      auth: () => ({ staff, sessions: h.deps.sessions, keys: h.deps.keys }),
      fieldKek: () => h.deps.kek,
      meta: async () => h.meta,
      now: () => h.deps.clock!(),
    });
  });
  afterAll(async () => {
    setAdminRuntime(null);
    await h?.drop();
  });

  it('saves a sealed copy of the address when the bell loads, so summaries can reach a person who never opened settings', async () => {
    const { member, actor } = await person('editor');
    expect(await stored(member.id)).toBeUndefined();
    await realNotices.feed(actor);
    const row = await stored(member.id);
    expect(row?.addressEnc).toBeTruthy();
    expect(row?.addressEnc?.toString('utf8')).not.toContain(member.email);
    expect(openAddress(h.deps.kek, `prefs:${member.id}`, row!.addressEnc!)).toBe(member.email);
    expect(row).toMatchObject({ failures: true, captionsReady: false, emailFrequency: 'hourly' });
  });

  it('does not rewrite the copy on every page load', async () => {
    const { member, actor } = await person('admin');
    await realNotices.feed(actor);
    const first = (await stored(member.id))!;
    await realNotices.feed(actor);
    const second = (await stored(member.id))!;
    expect(second.addressEnc?.equals(first.addressEnc!)).toBe(true);
    expect(second.updatedAt.getTime()).toBe(first.updatedAt.getTime());
  });

  it('saves the frequency with the other choices and keeps the address', async () => {
    const { member, actor } = await person('editor');
    const result = await realNotices.setPrefs(actor, {
      emailFrequency: 'immediate',
      captionsReady: true,
    });
    expect(result).toMatchObject({
      ok: true,
      prefs: { emailFrequency: 'immediate', captionsReady: true, failures: true },
    });
    expect((await stored(member.id))?.addressEnc).toBeTruthy();
    expect((await realNotices.prefs(actor)).emailFrequency).toBe('immediate');
  });

  it('answers an unknown frequency with a message, not a crash', async () => {
    const { actor } = await person('editor');
    const result = await realNotices.setPrefs(actor, { emailFrequency: 'weekly' as never });
    expect(result).toMatchObject({ ok: false });
  });

  it('copies the address again after the email changes, because the database clears the old copy', async () => {
    const { member, actor } = await person('admin');
    await realNotices.feed(actor);
    const newEmail = `moved.${member.email}`;
    await h.dbs.admin.db
      .update(schema.accounts)
      .set({ emailEnc: await h.deps.keys.seal(member.id, 'email', newEmail) })
      .where(eq(schema.accounts.id, member.id));
    expect((await stored(member.id))?.addressEnc).toBeNull();
    await realNotices.feed(actor);
    const row = (await stored(member.id))!;
    expect(openAddress(h.deps.kek, `prefs:${member.id}`, row.addressEnc!)).toBe(newEmail);
  });

  it('never lets the bell fail because the copy could not be saved', async () => {
    const { actor } = await person('editor');
    setAdminRuntime({
      db: () => h.dbs.app.db,
      auth: () => ({ staff, sessions: h.deps.sessions, keys: h.deps.keys }),
      fieldKek: () => {
        throw new Error('no key');
      },
      meta: async () => h.meta,
    });
    await expect(realNotices.feed(actor)).resolves.toMatchObject({ unread: 0 });
    setAdminRuntime({
      db: () => h.dbs.app.db,
      auth: () => ({ staff, sessions: h.deps.sessions, keys: h.deps.keys }),
      fieldKek: () => h.deps.kek,
      meta: async () => h.meta,
    });
  });
});
