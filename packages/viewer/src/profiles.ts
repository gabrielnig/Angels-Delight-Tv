import { and, asc, eq, sql } from 'drizzle-orm';
import { profiles, withAccount } from '@ad/db';
import { Conflict, Forbidden, isUuid, NotFound, ValidationFailed, type Actor } from '@ad/shared';
import type { Audience } from '@ad/catalog';
import { spendAttempt, type ViewerContext } from './context';
import { dbErrorInfo } from './db-errors';
import { hashPin, PIN_PATTERN, verifyPin } from './pin';

/** Avatar presets (M03-S03). Profiles store only the id, the artwork lives in the UI package and can be swapped. */
export const AVATAR_IDS = [
  'sun',
  'moon',
  'star',
  'leaf',
  'drum',
  'book',
  'kite',
  'bird',
  'fish',
  'tree',
  'cloud',
  'spark',
] as const;

export const PROFILE_NAME_MAX = 20;
export const PROFILE_LIMIT_MESSAGE = 'You have reached the profile limit for this account';
export const LAST_PROFILE_MESSAGE = 'You need at least one profile';
export const LAST_ADULT_MESSAGE = 'Keep at least one grown-up profile';
const MAX_POSITION = 9;

type ProfileRow = typeof profiles.$inferSelect;
type ViewerTx = Parameters<Parameters<ViewerContext['db']['transaction']>[0]>[0];

export interface ProfileDto {
  id: string;
  name: string;
  avatarId: string;
  isKids: boolean;
  isPrimary: boolean;
  hasPin: boolean;
  language: string;
  autoplayNext: boolean;
  dataSaver: boolean;
  position: number;
  /** Send this back as `expectedUpdatedAt` so a stale edit is rejected (M03-S04). */
  updatedAt: string;
}

export interface CreateProfileInput {
  name: string;
  avatarId: string;
  isKids?: boolean;
  language?: string;
  autoplayNext?: boolean;
  dataSaver?: boolean;
}

export interface UpdateProfileInput {
  name?: string;
  avatarId?: string;
  isKids?: boolean;
  language?: string;
  autoplayNext?: boolean;
  dataSaver?: boolean;
  /** A four digit PIN to set, or null to remove it. Adult profiles only. */
  pin?: string | null;
}

/** Facts the client states about the request. The server decides what they allow. */
export interface ManageOptions {
  /** The profile active in this browser, from the signed active profile cookie. A kids profile may not manage. */
  activeProfileId?: string | null;
  password?: string;
  expectedUpdatedAt?: string;
}

export function audienceOf(profile: Pick<ProfileRow, 'isKids'>): Audience {
  return { kids: profile.isKids };
}

/**
 * The one way to reach a profile by id. Scopes by account explicitly because the admin read policy would
 * otherwise let an admin account load a viewer's profile through the viewer API. Foreign and unknown ids look the
 * same (404), so existence does not leak (docs/SECURITY.md section 5).
 */
export async function loadOwnedProfile(
  tx: ViewerTx,
  actor: Actor,
  profileId: string,
): Promise<ProfileRow> {
  if (!isUuid(profileId)) throw new NotFound('Profile not found');
  const [row] = await tx
    .select()
    .from(profiles)
    .where(and(eq(profiles.id, profileId), eq(profiles.accountId, actor.accountId)))
    .limit(1);
  if (!row) throw new NotFound('Profile not found');
  return row;
}

async function toDto(ctx: ViewerContext, accountId: string, row: ProfileRow): Promise<ProfileDto> {
  return {
    id: row.id,
    name: await ctx.nameCipher.open(accountId, row.nameEnc),
    avatarId: row.avatarId,
    isKids: row.isKids,
    isPrimary: row.isPrimary,
    hasPin: row.pinHash !== null,
    language: row.language,
    autoplayNext: row.autoplayNext,
    dataSaver: row.dataSaver,
    position: row.position,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function normalizeProfileName(raw: string): string {
  const name = raw.trim().replace(/\s+/g, ' ');
  if (name.length < 1) throw new ValidationFailed({ name: ['Enter a name'] });
  if ([...name].length > PROFILE_NAME_MAX) {
    throw new ValidationFailed({ name: [`Use ${PROFILE_NAME_MAX} characters or fewer`] });
  }
  if (/\p{Extended_Pictographic}/u.test(name)) {
    throw new ValidationFailed({ name: ['Names cannot contain emoji'] });
  }
  return name;
}

function assertAvatar(avatarId: string): void {
  if (!(AVATAR_IDS as readonly string[]).includes(avatarId)) {
    throw new ValidationFailed({ avatarId: ['Choose one of the avatars'] });
  }
}

/** A kids profile may not manage profiles or the account (M35-S02). Not seeing the active profile means the picker. */
async function assertGrownUpContext(
  tx: ViewerTx,
  actor: Actor,
  activeProfileId: string | null | undefined,
): Promise<void> {
  if (!activeProfileId) return;
  const [active] = await tx
    .select({ isKids: profiles.isKids })
    .from(profiles)
    .where(and(eq(profiles.id, activeProfileId), eq(profiles.accountId, actor.accountId)))
    .limit(1);
  if (active?.isKids) throw new Forbidden('kids_gate');
}

async function lockAccount(tx: ViewerTx, accountId: string): Promise<void> {
  await tx.execute(sql`SELECT 1 FROM accounts WHERE id = ${accountId}::uuid FOR UPDATE`);
}

async function accountProfiles(tx: ViewerTx, accountId: string): Promise<ProfileRow[]> {
  return tx
    .select()
    .from(profiles)
    .where(eq(profiles.accountId, accountId))
    .orderBy(asc(profiles.position), asc(profiles.createdAt));
}

async function assertNameFree(
  ctx: ViewerContext,
  accountId: string,
  siblings: ProfileRow[],
  name: string,
): Promise<void> {
  const wanted = name.toLocaleLowerCase();
  for (const sibling of siblings) {
    const existing = await ctx.nameCipher.open(accountId, sibling.nameEnc);
    if (existing.toLocaleLowerCase() === wanted) {
      throw new Conflict('You already have a profile with that name');
    }
  }
}

export async function listProfiles(ctx: ViewerContext, actor: Actor): Promise<ProfileDto[]> {
  const rows = await withAccount(ctx.db, actor, (tx) => accountProfiles(tx, actor.accountId));
  return Promise.all(rows.map((row) => toDto(ctx, actor.accountId, row)));
}

export async function createProfile(
  ctx: ViewerContext,
  actor: Actor,
  input: CreateProfileInput,
  options: Pick<ManageOptions, 'activeProfileId'> = {},
): Promise<ProfileDto> {
  const name = normalizeProfileName(input.name);
  assertAvatar(input.avatarId);
  const sealed = await ctx.nameCipher.seal(actor.accountId, name);

  const row = await withAccount(ctx.db, actor, async (tx) => {
    await assertGrownUpContext(tx, actor, options.activeProfileId);
    await lockAccount(tx, actor.accountId);
    const siblings = await accountProfiles(tx, actor.accountId);
    const isFirst = siblings.length === 0;
    if (isFirst && input.isKids) {
      throw new ValidationFailed({ isKids: ['The first profile must be a grown-up profile'] });
    }
    await assertNameFree(ctx, actor.accountId, siblings, name);
    const taken = new Set(siblings.map((sibling) => sibling.position));
    let position = 0;
    while (taken.has(position)) position++;
    if (position > MAX_POSITION) throw new Conflict(PROFILE_LIMIT_MESSAGE);

    try {
      const [created] = await tx
        .insert(profiles)
        .values({
          accountId: actor.accountId,
          nameEnc: Buffer.from(sealed),
          avatarId: input.avatarId,
          isKids: input.isKids ?? false,
          isPrimary: isFirst,
          language: input.language ?? 'en',
          autoplayNext: input.autoplayNext ?? true,
          dataSaver: input.dataSaver ?? false,
          position,
        })
        .returning();
      return created!;
    } catch (error) {
      if (dbErrorInfo(error).message.includes('profile limit reached')) {
        throw new Conflict(PROFILE_LIMIT_MESSAGE);
      }
      throw error;
    }
  });
  return toDto(ctx, actor.accountId, row);
}

async function promoteAnotherPrimary(tx: ViewerTx, accountId: string): Promise<void> {
  const remaining = await accountProfiles(tx, accountId);
  if (remaining.some((profile) => profile.isPrimary)) return;
  const next = remaining.find((profile) => !profile.isKids);
  if (next) await tx.update(profiles).set({ isPrimary: true }).where(eq(profiles.id, next.id));
}

export async function updateProfile(
  ctx: ViewerContext,
  actor: Actor,
  profileId: string,
  input: UpdateProfileInput,
  options: ManageOptions = {},
): Promise<ProfileDto> {
  const name = input.name === undefined ? undefined : normalizeProfileName(input.name);
  if (input.avatarId !== undefined) assertAvatar(input.avatarId);
  if (typeof input.pin === 'string' && !PIN_PATTERN.test(input.pin)) {
    throw new ValidationFailed({ pin: ['Use exactly four digits'] });
  }
  const sealed = name === undefined ? undefined : await ctx.nameCipher.seal(actor.accountId, name);

  const row = await withAccount(ctx.db, actor, async (tx) => {
    await assertGrownUpContext(tx, actor, options.activeProfileId);
    await lockAccount(tx, actor.accountId);
    const current = await loadOwnedProfile(tx, actor, profileId);
    const siblings = (await accountProfiles(tx, actor.accountId)).filter(
      (sibling) => sibling.id !== current.id,
    );

    const leavingKids = input.isKids === false && current.isKids;
    const enteringKids = input.isKids === true && !current.isKids;
    const touchesPin = input.pin !== undefined;
    if (leavingKids || touchesPin) {
      if (!options.password) throw new Forbidden('password_required');
      // Shares the budget of leaving kids mode, so this route is not an unlimited password oracle.
      await spendAttempt(ctx, 'kids_exit', actor.accountId);
      if (!(await ctx.verifyPassword(actor.accountId, options.password))) {
        throw new Forbidden('password_required');
      }
    }
    if (enteringKids && !siblings.some((sibling) => !sibling.isKids)) {
      throw new Conflict(LAST_ADULT_MESSAGE);
    }
    if (typeof input.pin === 'string' && (input.isKids ?? current.isKids)) {
      throw new ValidationFailed({ pin: ['A PIN is only for grown-up profiles'] });
    }
    if (name !== undefined) await assertNameFree(ctx, actor.accountId, siblings, name);

    const changes: Partial<typeof profiles.$inferInsert> = {};
    if (sealed !== undefined) changes.nameEnc = Buffer.from(sealed);
    if (input.avatarId !== undefined) changes.avatarId = input.avatarId;
    if (input.isKids !== undefined) changes.isKids = input.isKids;
    if (input.language !== undefined) changes.language = input.language;
    if (input.autoplayNext !== undefined) changes.autoplayNext = input.autoplayNext;
    if (input.dataSaver !== undefined) changes.dataSaver = input.dataSaver;
    if (input.pin !== undefined) {
      changes.pinHash = input.pin === null ? null : await hashPin(input.pin);
    }
    if (enteringKids || (input.isKids === true && current.isPrimary)) {
      changes.isPrimary = false;
      changes.pinHash = null;
    }

    const stillCurrent =
      options.expectedUpdatedAt === undefined
        ? sql`true`
        : sql`date_trunc('milliseconds', ${profiles.updatedAt}) = ${options.expectedUpdatedAt}::timestamptz`;
    const [updated] = await tx
      .update(profiles)
      .set(changes)
      .where(and(eq(profiles.id, current.id), stillCurrent))
      .returning();
    if (!updated) throw new Conflict('This profile changed. Reload.');
    if (current.isPrimary && changes.isPrimary === false) {
      await promoteAnotherPrimary(tx, actor.accountId);
    }
    return updated;
  });
  return toDto(ctx, actor.accountId, row);
}

export async function deleteProfile(
  ctx: ViewerContext,
  actor: Actor,
  profileId: string,
  options: Pick<ManageOptions, 'activeProfileId'> = {},
): Promise<void> {
  await withAccount(ctx.db, actor, async (tx) => {
    await assertGrownUpContext(tx, actor, options.activeProfileId);
    await lockAccount(tx, actor.accountId);
    const current = await loadOwnedProfile(tx, actor, profileId);
    const siblings = (await accountProfiles(tx, actor.accountId)).filter(
      (sibling) => sibling.id !== current.id,
    );
    if (siblings.length === 0) throw new Conflict(LAST_PROFILE_MESSAGE);
    if (!current.isKids && !siblings.some((sibling) => !sibling.isKids)) {
      throw new Conflict(LAST_ADULT_MESSAGE);
    }
    await tx.delete(profiles).where(eq(profiles.id, current.id));
    if (current.isPrimary) await promoteAnotherPrimary(tx, actor.accountId);
  });
}

/**
 * Confirms the actor may open the profile and returns it. A profile with a PIN needs the PIN, attempts are
 * limited per profile when a rate limiter is configured.
 */
export async function selectProfile(
  ctx: ViewerContext,
  actor: Actor,
  profileId: string,
  options: { pin?: string; kidsLocked?: boolean } = {},
): Promise<ProfileDto> {
  const row = await withAccount(ctx.db, actor, async (tx) => {
    const target = await loadOwnedProfile(tx, actor, profileId);
    // The lock comes from the session row. Leaving a kids profile goes through exitKidsMode and the password.
    if (options.kidsLocked && !target.isKids) throw new Forbidden('kids_gate');
    return target;
  });
  if (row.pinHash !== null) {
    if (options.pin === undefined) throw new Forbidden('pin_required');
    await spendAttempt(ctx, 'profile_pin', row.id);
    if (!(await verifyPin(options.pin, row.pinHash))) throw new Forbidden('pin_invalid');
  }
  return toDto(ctx, actor.accountId, row);
}

/** Leaving a kids profile needs the account password and is rate limited like sign in (M35-S03). */
export async function exitKidsMode(
  ctx: ViewerContext,
  actor: Actor,
  input: { password: string },
): Promise<{ ok: true }> {
  await spendAttempt(ctx, 'kids_exit', actor.accountId);
  if (!(await ctx.verifyPassword(actor.accountId, input.password))) {
    throw new Forbidden('password_incorrect');
  }
  return { ok: true };
}
