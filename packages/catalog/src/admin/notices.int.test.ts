import { adminNotices } from '@ad/db';
import type { Actor } from '@ad/shared';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createViewerTestDb, integrationEnabled, seedAccount, type ViewerTestDb } from '../testing';
import {
  DEFAULT_NOTIFICATION_PREFS,
  getNotificationPrefs,
  listAdminNotices,
  markAdminNoticesRead,
  setNotificationPrefs,
} from './notices';
import type { AdminContext } from './types';

describe.skipIf(!integrationEnabled())('admin notices and preferences', () => {
  let t: ViewerTestDb;
  let ctx: AdminContext;
  let one: Actor;
  let two: Actor;
  let viewer: Actor;

  const add = (who: Actor, title: string, kind = 'encode_failed', ago = 0) =>
    t.setup.insert(adminNotices).values({
      recipientId: who.accountId,
      kind,
      title,
      createdAt: new Date(Date.now() - ago),
    });

  beforeAll(async () => {
    t = await createViewerTestDb();
    ctx = { db: t.app };
    one = { accountId: (await seedAccount(t.setup, 'editor')).id, role: 'editor' };
    two = { accountId: (await seedAccount(t.setup, 'admin')).id, role: 'admin' };
    viewer = { accountId: (await seedAccount(t.setup, 'viewer')).id, role: 'viewer' };
  });
  afterAll(async () => {
    await t?.drop();
  });

  it('shows nothing new for an empty bell and refuses a viewer', async () => {
    expect(await listAdminNotices(ctx, one)).toEqual({ items: [], unread: 0 });
    await expect(listAdminNotices(ctx, viewer)).rejects.toThrow();
    await expect(markAdminNoticesRead(ctx, viewer)).rejects.toThrow();
    await expect(getNotificationPrefs(ctx, viewer)).rejects.toThrow();
  });

  it('lists only my notices, newest first, with the unread count', async () => {
    await add(one, 'Older', 'encode_done', 5000);
    await add(one, 'Newer', 'captions_ready', 1000);
    await add(two, 'Not mine');
    const list = await listAdminNotices(ctx, one);
    expect(list.items.map((n) => n.title)).toEqual(['Newer', 'Older']);
    expect(list.unread).toBe(2);
    expect((await listAdminNotices(ctx, one, { limit: 1 })).items).toHaveLength(1);
  });

  it('marks all read for me without clearing another admin bell, and one by id', async () => {
    const before = await listAdminNotices(ctx, two);
    expect(await markAdminNoticesRead(ctx, one)).toBe(2);
    expect((await listAdminNotices(ctx, one)).unread).toBe(0);
    expect((await listAdminNotices(ctx, two)).unread).toBe(before.unread);
    expect(await markAdminNoticesRead(ctx, one)).toBe(0);

    const target = before.items[0]!;
    expect(await markAdminNoticesRead(ctx, one, [target.id])).toBe(0);
    expect((await listAdminNotices(ctx, two)).unread).toBe(before.unread);
    expect(await markAdminNoticesRead(ctx, two, [target.id, 'not-a-uuid'])).toBe(1);
    expect(await markAdminNoticesRead(ctx, two, ['not-a-uuid'])).toBe(0);
    const row = (
      await t.setup.select().from(adminNotices).where(eq(adminNotices.id, target.id))
    )[0]!;
    expect(row.readAt).not.toBeNull();
  });

  it('defaults to failures only, saves per admin, and changes only the keys given', async () => {
    expect(await getNotificationPrefs(ctx, one)).toEqual(DEFAULT_NOTIFICATION_PREFS);
    expect(DEFAULT_NOTIFICATION_PREFS).toEqual({
      failures: true,
      captionsReady: false,
      dailySummary: false,
    });
    expect(await setNotificationPrefs(ctx, one, { captionsReady: true })).toEqual({
      failures: true,
      captionsReady: true,
      dailySummary: false,
    });
    await setNotificationPrefs(ctx, one, { failures: false });
    expect(await getNotificationPrefs(ctx, one)).toEqual({
      failures: false,
      captionsReady: true,
      dailySummary: false,
    });
    expect(await getNotificationPrefs(ctx, two)).toEqual(DEFAULT_NOTIFICATION_PREFS);
    await expect(setNotificationPrefs(ctx, viewer, { failures: false })).rejects.toThrow();
  });
});
