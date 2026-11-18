import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { adminNotices, staffNotificationPrefs, withAccount } from '@ad/db';
import { Forbidden, isUuid, type Actor, isStaffRole } from '@ad/shared';
import type { AdminContext } from './types';

function assertStaff(actor: Actor): void {
  if (!isStaffRole(actor.role)) throw new Forbidden('Staff only');
}

export interface AdminNotice {
  id: string;
  kind: 'encode_done' | 'encode_failed' | 'captions_ready' | 'captions_failed';
  title: string;
  body: string;
  href: string | null;
  createdAt: string;
  read: boolean;
}

export interface NoticeList {
  items: AdminNotice[];
  unread: number;
}

export const NOTICE_LIST_MAX = 50;

/** The caller's own notices, newest first, and how many are unread (the bell badge). */
export async function listAdminNotices(
  ctx: AdminContext,
  actor: Actor,
  options: { limit?: number } = {},
): Promise<NoticeList> {
  assertStaff(actor);
  const limit = Math.min(NOTICE_LIST_MAX, Math.max(1, Math.trunc(options.limit ?? 20)));
  return withAccount(ctx.db, actor, async (tx) => {
    const rows = await tx
      .select()
      .from(adminNotices)
      .where(eq(adminNotices.recipientId, actor.accountId))
      .orderBy(desc(adminNotices.createdAt), desc(adminNotices.id))
      .limit(limit);
    const [count] = await tx
      .select({ n: sql<number>`count(*)::int` })
      .from(adminNotices)
      .where(and(eq(adminNotices.recipientId, actor.accountId), isNull(adminNotices.readAt)));
    return {
      unread: count?.n ?? 0,
      items: rows.map((row) => ({
        id: row.id,
        kind: row.kind as AdminNotice['kind'],
        title: row.title,
        body: row.body,
        href: row.href,
        createdAt: row.createdAt.toISOString(),
        read: row.readAt !== null,
      })),
    };
  });
}

/** Marks the caller's notices read: the ones named, or every unread one. Another person's notices are never touched. */
export async function markAdminNoticesRead(
  ctx: AdminContext,
  actor: Actor,
  ids?: readonly string[],
): Promise<number> {
  assertStaff(actor);
  const valid = ids?.filter(isUuid);
  if (ids && !valid?.length) return 0;
  return withAccount(ctx.db, actor, async (tx) => {
    const rows = await tx
      .update(adminNotices)
      .set({ readAt: new Date() })
      .where(
        and(
          eq(adminNotices.recipientId, actor.accountId),
          isNull(adminNotices.readAt),
          valid ? inArray(adminNotices.id, valid) : undefined,
        ),
      )
      .returning({ id: adminNotices.id });
    return rows.length;
  });
}

export interface NotificationPrefs {
  /** Email when encoding or caption generation fails. On by default. */
  failures: boolean;
  captionsReady: boolean;
  dailySummary: boolean;
}

export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  failures: true,
  captionsReady: false,
  dailySummary: false,
};

export async function getNotificationPrefs(
  ctx: AdminContext,
  actor: Actor,
): Promise<NotificationPrefs> {
  assertStaff(actor);
  return withAccount(ctx.db, actor, async (tx) => {
    const [row] = await tx
      .select()
      .from(staffNotificationPrefs)
      .where(eq(staffNotificationPrefs.accountId, actor.accountId));
    return row
      ? { failures: row.failures, captionsReady: row.captionsReady, dailySummary: row.dailySummary }
      : { ...DEFAULT_NOTIFICATION_PREFS };
  });
}

/** Saves the caller's choices. Only the keys given change. Security email is not a choice and is not stored here. */
export async function setNotificationPrefs(
  ctx: AdminContext,
  actor: Actor,
  patch: Partial<NotificationPrefs>,
): Promise<NotificationPrefs> {
  assertStaff(actor);
  const current = await getNotificationPrefs(ctx, actor);
  const next: NotificationPrefs = {
    failures: patch.failures ?? current.failures,
    captionsReady: patch.captionsReady ?? current.captionsReady,
    dailySummary: patch.dailySummary ?? current.dailySummary,
  };
  await withAccount(ctx.db, actor, async (tx) => {
    await tx
      .insert(staffNotificationPrefs)
      .values({ accountId: actor.accountId, ...next })
      .onConflictDoUpdate({
        target: staffNotificationPrefs.accountId,
        set: { ...next, updatedAt: new Date() },
      });
  });
  return next;
}
