import { and, desc, eq, inArray, isNull, lt, or, sql } from 'drizzle-orm';
import { viewerNotices, viewerNotificationPrefs, withAccount } from '@ad/db';
import { Forbidden, isUuid, ValidationFailed, type Actor } from '@ad/shared';
import type { ViewerContext } from './context';
import { loadOwnedProfile } from './profiles';

/** Viewer notices and the account's notification choices (L5, M44-S11, S14, S17). Read state is per profile. */

export const KIDS_NO_NOTICES = 'kids_no_notices';
export const UNREAD_CAP = 99;
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;
const MAX_IDS = 100;

export interface NoticeDto {
  id: string;
  kind: 'new_episode' | 'new_video';
  title: string;
  body: string;
  href: string;
  itemCount: number;
  createdAt: string;
  read: boolean;
}

export interface NoticePage {
  items: NoticeDto[];
  unread: number;
  nextCursor: string | null;
}

export interface NotificationPrefs {
  bell: boolean;
  newEpisodes: boolean;
  newVideos: boolean;
  emailFrequency: 'off' | 'daily' | 'weekly';
  /** The address the digest goes to with the middle hidden, or null while email is off. */
  addressMasked: string | null;
  /** True when a sealed address is stored. False while email is on means the page should seal it again. */
  hasAddress: boolean;
  consentedAt: string | null;
}

type Tx = Parameters<Parameters<ViewerContext['db']['transaction']>[0]>[0];

/** Loads the profile and refuses a kids profile. Every notice route calls this first. */
async function adultProfile(tx: Tx, actor: Actor, profileId: string) {
  const profile = await loadOwnedProfile(tx, actor, profileId);
  if (profile.isKids) throw new Forbidden(KIDS_NO_NOTICES);
  return profile;
}

function encodeCursor(createdAt: Date, id: string): string {
  return Buffer.from(JSON.stringify({ t: createdAt.toISOString(), i: id })).toString('base64url');
}

function decodeCursor(cursor: string): { t: Date; i: string } {
  try {
    const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as { t?: unknown; i?: unknown };
    const t = new Date(String(parsed.t));
    if (typeof parsed.i === 'string' && isUuid(parsed.i) && !Number.isNaN(t.getTime())) return { t, i: parsed.i };
  } catch {
    // fall through
  }
  throw new ValidationFailed({ cursor: ['That page link is not valid'] });
}

async function unreadOf(tx: Tx, profileId: string): Promise<number> {
  const result = await tx.execute<{ n: number }>(sql`
    SELECT count(*)::int AS n FROM (
      SELECT 1 FROM viewer_notices WHERE profile_id = ${profileId}::uuid AND read_at IS NULL LIMIT ${UNREAD_CAP}
    ) capped`);
  return result.rows[0]?.n ?? 0;
}

export async function listNotices(
  ctx: ViewerContext,
  actor: Actor,
  input: { profileId: string; limit?: number; cursor?: string },
): Promise<NoticePage> {
  const limit = Math.min(Math.max(Math.trunc(input.limit ?? DEFAULT_LIMIT), 1), MAX_LIMIT);
  return withAccount(ctx.db, actor, async (tx) => {
    const profile = await adultProfile(tx, actor, input.profileId);
    const after = input.cursor ? decodeCursor(input.cursor) : null;
    const rows = await tx
      .select()
      .from(viewerNotices)
      .where(
        and(
          eq(viewerNotices.profileId, profile.id),
          after
            ? or(
                lt(viewerNotices.createdAt, after.t),
                and(eq(viewerNotices.createdAt, after.t), lt(viewerNotices.id, after.i)),
              )
            : undefined,
        ),
      )
      .orderBy(desc(viewerNotices.createdAt), desc(viewerNotices.id))
      .limit(limit + 1);
    const page = rows.slice(0, limit);
    const last = page[page.length - 1];
    return {
      items: page.map((row) => ({
        id: row.id,
        kind: row.kind as NoticeDto['kind'],
        title: row.title,
        body: row.body,
        href: row.href,
        itemCount: row.itemCount,
        createdAt: row.createdAt.toISOString(),
        read: row.readAt !== null,
      })),
      unread: await unreadOf(tx, profile.id),
      nextCursor: rows.length > limit && last ? encodeCursor(last.createdAt, last.id) : null,
    };
  });
}

/** The bell number, capped at 99. A kids profile always gets 0 and the notices table is not read. */
export async function countUnread(
  ctx: ViewerContext,
  actor: Actor,
  input: { profileId: string },
): Promise<number> {
  return withAccount(ctx.db, actor, async (tx) => {
    const profile = await loadOwnedProfile(tx, actor, input.profileId);
    if (profile.isKids) return 0;
    return unreadOf(tx, profile.id);
  });
}

export async function markRead(
  ctx: ViewerContext,
  actor: Actor,
  input: { profileId: string; ids: readonly string[] | 'all' },
): Promise<{ updated: number }> {
  if (input.ids !== 'all') {
    if (input.ids.length === 0 || input.ids.length > MAX_IDS || !input.ids.every((id) => isUuid(id)))
      throw new ValidationFailed({ ids: ['Choose up to 100 notices'] });
  }
  return withAccount(ctx.db, actor, async (tx) => {
    const profile = await adultProfile(tx, actor, input.profileId);
    const rows = await tx
      .update(viewerNotices)
      .set({ readAt: ctx.now?.() ?? new Date() })
      .where(
        and(
          eq(viewerNotices.profileId, profile.id),
          isNull(viewerNotices.readAt),
          input.ids === 'all' ? undefined : inArray(viewerNotices.id, [...input.ids]),
        ),
      )
      .returning({ id: viewerNotices.id });
    return { updated: rows.length };
  });
}

function toPrefs(row: typeof viewerNotificationPrefs.$inferSelect | undefined): NotificationPrefs {
  return {
    bell: row?.bell ?? true,
    newEpisodes: row?.newEpisodes ?? true,
    newVideos: row?.newVideos ?? true,
    emailFrequency: (row?.emailFrequency as NotificationPrefs['emailFrequency'] | undefined) ?? 'off',
    addressMasked: null,
    hasAddress: Boolean(row?.addressEnc),
    consentedAt: row?.addressConsentedAt?.toISOString() ?? null,
  };
}

export async function getPrefs(
  ctx: ViewerContext,
  actor: Actor,
  input: { profileId: string },
): Promise<NotificationPrefs> {
  return withAccount(ctx.db, actor, async (tx) => {
    await adultProfile(tx, actor, input.profileId);
    const [row] = await tx
      .select()
      .from(viewerNotificationPrefs)
      .where(eq(viewerNotificationPrefs.accountId, actor.accountId));
    return toPrefs(row);
  });
}

export interface PrefsChange {
  profileId: string;
  bell?: boolean;
  newEpisodes?: boolean;
  newVideos?: boolean;
}

/** Saves only the switches that were sent. The account row is created on first save. */
export async function setPrefs(
  ctx: ViewerContext,
  actor: Actor,
  input: PrefsChange,
): Promise<NotificationPrefs> {
  const changes: Partial<Pick<typeof viewerNotificationPrefs.$inferInsert, 'bell' | 'newEpisodes' | 'newVideos'>> = {};
  const errors: Record<string, string[]> = {};
  for (const key of ['bell', 'newEpisodes', 'newVideos'] as const) {
    const value = input[key];
    if (value === undefined) continue;
    if (typeof value !== 'boolean') errors[key] = ['Choose on or off'];
    else changes[key] = value;
  }
  if (Object.keys(errors).length > 0) throw new ValidationFailed(errors);
  return withAccount(ctx.db, actor, async (tx) => {
    await adultProfile(tx, actor, input.profileId);
    const now = ctx.now?.() ?? new Date();
    const [row] = await tx
      .insert(viewerNotificationPrefs)
      .values({ accountId: actor.accountId, ...changes, updatedAt: now })
      .onConflictDoUpdate({
        target: viewerNotificationPrefs.accountId,
        set: { ...changes, updatedAt: now },
      })
      .returning();
    return toPrefs(row);
  });
}

export interface EmailChange {
  profileId: string;
  frequency: NotificationPrefs['emailFrequency'];
  /** The explicit tick that email is wanted (consent, NDPA). Needed to switch on. */
  confirm?: boolean;
  /** The account address sealed by the caller with the field key (D-129). Needed to switch on. */
  sealedAddress?: Uint8Array;
}

/**
 * Switches the digest email Off, Daily or Weekly. On needs the confirmation and a sealed address and records the
 * consent time once. Off clears the address and the consent. Adults only.
 */
export async function setEmail(
  ctx: ViewerContext,
  actor: Actor,
  input: EmailChange,
): Promise<NotificationPrefs> {
  if (!['off', 'daily', 'weekly'].includes(input.frequency))
    throw new ValidationFailed({ frequency: ['Choose Off, Daily or Weekly'] });
  if (input.frequency !== 'off') {
    const errors: Record<string, string[]> = {};
    if (input.confirm !== true) errors.confirm = ['Confirm that you want these emails'];
    if (!input.sealedAddress || input.sealedAddress.length === 0) errors.address = ['We could not read your email address'];
    if (Object.keys(errors).length > 0) throw new ValidationFailed(errors);
  }
  return withAccount(ctx.db, actor, async (tx) => {
    await adultProfile(tx, actor, input.profileId);
    const now = ctx.now?.() ?? new Date();
    const [existing] = await tx
      .select()
      .from(viewerNotificationPrefs)
      .where(eq(viewerNotificationPrefs.accountId, actor.accountId));
    const on = input.frequency !== 'off';
    const values = {
      emailFrequency: input.frequency,
      addressEnc: on ? Buffer.from(input.sealedAddress as Uint8Array) : null,
      addressConsentedAt: on ? (existing?.addressConsentedAt ?? now) : null,
      updatedAt: now,
    };
    const [row] = await tx
      .insert(viewerNotificationPrefs)
      .values({ accountId: actor.accountId, ...values })
      .onConflictDoUpdate({ target: viewerNotificationPrefs.accountId, set: values })
      .returning();
    return toPrefs(row);
  });
}

/** Seals the address again after an account email change cleared it. Does nothing while email is off. */
export async function saveAddress(
  ctx: ViewerContext,
  actor: Actor,
  input: { profileId: string; sealedAddress: Uint8Array },
): Promise<void> {
  await withAccount(ctx.db, actor, async (tx) => {
    await adultProfile(tx, actor, input.profileId);
    await tx
      .update(viewerNotificationPrefs)
      .set({ addressEnc: Buffer.from(input.sealedAddress) })
      .where(
        and(
          eq(viewerNotificationPrefs.accountId, actor.accountId),
          sql`${viewerNotificationPrefs.emailFrequency} <> 'off'`,
        ),
      );
  });
}
