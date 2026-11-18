import { myList, profiles, series, videos, watchProgress, withAccount } from '@ad/db';
import { constantTimeEqual, hmacSha256, NotFound, ValidationFailed } from '@ad/shared';
import { loadOwnedProfile, type ViewerContext as ServiceContext } from '@ad/viewer';
import { and, asc, desc, eq, gte, inArray, sql } from 'drizzle-orm';
import type { PlaybackSettings } from '../../lib/data/types';
import { viewerActor } from './actor';

export const DEFAULT_PLAYBACK: PlaybackSettings = {
  autoplayNext: true,
  dataSaver: false,
  quality: 'auto',
  speed: 1,
  captionsDefault: true,
  captionSize: 'medium',
};

const QUALITIES = ['auto', '1080', '720', '480', '360'] as const;
const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2] as const;
const CAPTION_SIZES = ['small', 'medium', 'large', 'xlarge'] as const;
const EXPORT_TOKEN_SECONDS = 10 * 60;
const LAGOS_OFFSET_MS = 60 * 60 * 1000;
const encoder = new TextEncoder();

export interface AccountStats {
  watchedThisMonth: number;
  minutesLearning: number;
  myListCount: number;
}

export interface ExportFile {
  exportedAt: string;
  account: { email: string; memberSince: string };
  profiles: Array<{
    name: string;
    kids: boolean;
    language: string;
    playback: PlaybackSettings;
    myList: Array<{ kind: 'video' | 'series'; title: string; slug: string; addedAt: string }>;
    progress: Array<{
      title: string;
      slug: string;
      positionSeconds: number;
      durationSeconds: number;
      completed: boolean;
      updatedAt: string;
    }>;
  }>;
}

function pick<T extends string | number>(value: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

/** Stored choices beyond the two profile columns. Anything unknown falls back to the default. */
function readPrefs(row: {
  autoplayNext: boolean;
  dataSaver: boolean;
  playbackPrefs: unknown;
}): PlaybackSettings {
  const stored = (
    typeof row.playbackPrefs === 'object' && row.playbackPrefs !== null ? row.playbackPrefs : {}
  ) as Record<string, unknown>;
  return {
    autoplayNext: row.autoplayNext,
    dataSaver: row.dataSaver,
    quality: pick(stored.quality, QUALITIES, DEFAULT_PLAYBACK.quality),
    speed: pick(stored.speed, SPEEDS, DEFAULT_PLAYBACK.speed),
    captionsDefault:
      typeof stored.captionsDefault === 'boolean'
        ? stored.captionsDefault
        : DEFAULT_PLAYBACK.captionsDefault,
    captionSize: pick(stored.captionSize, CAPTION_SIZES, DEFAULT_PLAYBACK.captionSize),
  };
}

function validatePatch(patch: Partial<PlaybackSettings>): void {
  const bad: Record<string, string[]> = {};
  if (patch.quality !== undefined && !QUALITIES.includes(patch.quality))
    bad.quality = ['Pick a listed quality'];
  if (patch.speed !== undefined && !SPEEDS.includes(patch.speed as (typeof SPEEDS)[number]))
    bad.speed = ['Pick a listed speed'];
  if (patch.captionSize !== undefined && !CAPTION_SIZES.includes(patch.captionSize))
    bad.captionSize = ['Pick a listed size'];
  for (const key of ['autoplayNext', 'dataSaver', 'captionsDefault'] as const) {
    if (patch[key] !== undefined && typeof patch[key] !== 'boolean') bad[key] = ['Use on or off'];
  }
  if (Object.keys(bad).length > 0) throw new ValidationFailed(bad);
}

/** Start of the current month in Lagos (UTC+1, no daylight saving), as a UTC instant. */
function monthStart(now: Date): Date {
  const lagos = new Date(now.getTime() + LAGOS_OFFSET_MS);
  return new Date(Date.UTC(lagos.getUTCFullYear(), lagos.getUTCMonth(), 1) - LAGOS_OFFSET_MS);
}

/**
 * The viewer data the account area needs beyond sign in: this month's numbers, per profile playback settings and
 * the data export. Everything runs in withAccount, so another account's rows are invisible to it.
 */
export class AccountViewerData {
  private readonly now: () => Date;
  private readonly exportKey: Uint8Array;

  constructor(
    private readonly service: ServiceContext,
    options: { exportSecret: Uint8Array; now?: () => Date },
  ) {
    this.now = options.now ?? (() => new Date());
    this.exportKey = hmacSha256(options.exportSecret, encoder.encode('ad:account-export:v1'));
  }

  async stats(accountId: string): Promise<AccountStats> {
    const since = monthStart(this.now());
    return withAccount(this.service.db, viewerActor(accountId), async (tx) => {
      const [watched] = await tx
        .select({
          n: sql<number>`count(*)::int`,
          ms: sql<number>`coalesce(sum(${watchProgress.positionMs}), 0)::bigint`,
        })
        .from(watchProgress)
        .innerJoin(profiles, eq(profiles.id, watchProgress.profileId))
        .where(and(eq(profiles.accountId, accountId), gte(watchProgress.updatedAt, since)));
      const [saved] = await tx
        .select({ n: sql<number>`count(*)::int` })
        .from(myList)
        .innerJoin(profiles, eq(profiles.id, myList.profileId))
        .where(eq(profiles.accountId, accountId));
      return {
        watchedThisMonth: Number(watched?.n ?? 0),
        minutesLearning: Math.round(Number(watched?.ms ?? 0) / 60_000),
        myListCount: Number(saved?.n ?? 0),
      };
    });
  }

  async playback(accountId: string, profileId: string): Promise<PlaybackSettings> {
    const actor = viewerActor(accountId);
    return withAccount(this.service.db, actor, async (tx) =>
      readPrefs(await loadOwnedProfile(tx, actor, profileId)),
    );
  }

  async savePlayback(
    accountId: string,
    profileId: string,
    patch: Partial<PlaybackSettings>,
  ): Promise<PlaybackSettings> {
    validatePatch(patch);
    const actor = viewerActor(accountId);
    return withAccount(this.service.db, actor, async (tx) => {
      const current = readPrefs(await loadOwnedProfile(tx, actor, profileId));
      const next: PlaybackSettings = { ...current, ...patch };
      const [updated] = await tx
        .update(profiles)
        .set({
          autoplayNext: next.autoplayNext,
          dataSaver: next.dataSaver,
          playbackPrefs: {
            quality: next.quality,
            speed: next.speed,
            captionsDefault: next.captionsDefault,
            captionSize: next.captionSize,
          },
        })
        .where(and(eq(profiles.id, profileId), eq(profiles.accountId, accountId)))
        .returning();
      if (!updated) throw new NotFound('Profile not found');
      return readPrefs(updated);
    });
  }

  /** Account, profiles, saved titles and progress. Never the password hash, sessions or keys (M02-S05). */
  async buildExport(
    accountId: string,
    account: { email: string; memberSince: string },
  ): Promise<ExportFile> {
    const actor = viewerActor(accountId);
    const rows = await withAccount(this.service.db, actor, async (tx) => {
      const owned = await tx
        .select()
        .from(profiles)
        .where(eq(profiles.accountId, accountId))
        .orderBy(asc(profiles.position), asc(profiles.createdAt));
      const ids = owned.map((p) => p.id);
      if (ids.length === 0) return { owned, saved: [], progress: [] };
      const saved = await tx
        .select({
          profileId: myList.profileId,
          addedAt: myList.addedAt,
          videoTitle: videos.title,
          videoSlug: videos.slug,
          seriesTitle: series.title,
          seriesSlug: series.slug,
        })
        .from(myList)
        .leftJoin(videos, eq(videos.id, myList.videoId))
        .leftJoin(series, eq(series.id, myList.seriesId))
        .where(inArray(myList.profileId, ids))
        .orderBy(desc(myList.addedAt));
      const progress = await tx
        .select({
          profileId: watchProgress.profileId,
          positionMs: watchProgress.positionMs,
          durationMs: watchProgress.durationMs,
          completed: watchProgress.completed,
          updatedAt: watchProgress.updatedAt,
          title: videos.title,
          slug: videos.slug,
        })
        .from(watchProgress)
        .innerJoin(videos, eq(videos.id, watchProgress.videoId))
        .where(inArray(watchProgress.profileId, ids))
        .orderBy(desc(watchProgress.updatedAt));
      return { owned, saved, progress };
    });
    const profilesOut: ExportFile['profiles'] = [];
    for (const profile of rows.owned) {
      profilesOut.push({
        name: await this.service.nameCipher.open(accountId, profile.nameEnc),
        kids: profile.isKids,
        language: profile.language,
        playback: readPrefs(profile),
        myList: rows.saved
          .filter((s) => s.profileId === profile.id)
          .map((s) =>
            s.videoTitle !== null
              ? {
                  kind: 'video' as const,
                  title: s.videoTitle,
                  slug: s.videoSlug!,
                  addedAt: s.addedAt.toISOString(),
                }
              : {
                  kind: 'series' as const,
                  title: s.seriesTitle ?? '',
                  slug: s.seriesSlug ?? '',
                  addedAt: s.addedAt.toISOString(),
                },
          ),
        progress: rows.progress
          .filter((p) => p.profileId === profile.id)
          .map((p) => ({
            title: p.title,
            slug: p.slug,
            positionSeconds: Math.round(p.positionMs / 1000),
            durationSeconds: Math.round(p.durationMs / 1000),
            completed: p.completed,
            updatedAt: p.updatedAt.toISOString(),
          })),
      });
    }
    return { exportedAt: this.now().toISOString(), account, profiles: profilesOut };
  }

  private mac(accountId: string, expires: number): string {
    return Buffer.from(
      hmacSha256(this.exportKey, encoder.encode(`${accountId}|${expires}`)),
    ).toString('base64url');
  }

  /** A link that works for ten minutes and only for this account. The route still needs the signed in session. */
  signExportToken(accountId: string, expiresAt?: Date): string {
    const expires = expiresAt
      ? Math.floor(expiresAt.getTime() / 1000)
      : Math.floor(this.now().getTime() / 1000) + EXPORT_TOKEN_SECONDS;
    return `${accountId}.${expires}.${this.mac(accountId, expires)}`;
  }

  /** The account id the token was issued for, or null when it is forged, expired or malformed. */
  verifyExportToken(token: string): string | null {
    const [accountId, expiresText, given, ...rest] = token.split('.');
    if (!accountId || !expiresText || !given || rest.length > 0) return null;
    const expires = Number(expiresText);
    if (!Number.isInteger(expires) || expires * 1000 < this.now().getTime()) return null;
    const a = encoder.encode(given);
    const b = encoder.encode(this.mac(accountId, expires));
    return a.length === b.length && constantTimeEqual(a, b) ? accountId : null;
  }
}
