import { captionColorAllowed } from '@ad/player';
import {
  accountIdentities,
  donations,
  loginEvents,
  myList,
  profiles,
  series,
  titleRatings,
  videos,
  viewerNotices,
  viewerNotificationPrefs,
  helpProgress,
  watchProgress,
  withAccount,
} from '@ad/db';
import { constantTimeEqual, hmacSha256, NotFound, ValidationFailed } from '@ad/shared';
import { loadOwnedProfile, type ViewerContext as ServiceContext } from '@ad/viewer';
import { and, asc, desc, eq, gte, inArray, sql } from 'drizzle-orm';
import type { PlaybackSettings } from '../../lib/data/types';
import { deviceLabel } from '../auth/devices';
import { viewerActor } from './actor';

export const DEFAULT_PLAYBACK: PlaybackSettings = {
  autoplayNext: true,
  autoplayPreviews: false,
  dataSaver: false,
  quality: 'auto',
  speed: 1,
  captionsDefault: true,
  captionSize: 'medium',
  captionBackground: 'dark',
  captionContrast: 'standard',
  captionEdge: 'shadow',
  captionColor: 'white',
  captionLanguage: 'en',
};

const QUALITIES = ['auto', '1080', '720', '480', '360'] as const;
const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2] as const;
const CAPTION_SIZES = ['small', 'medium', 'large', 'xlarge'] as const;
const CAPTION_BACKGROUNDS = ['none', 'dark', 'solid'] as const;
const CAPTION_CONTRASTS = ['standard', 'high'] as const;
const CAPTION_EDGES = ['none', 'shadow', 'outline'] as const;
const CAPTION_COLORS = ['white', 'yellow'] as const;
const LANGUAGE_CODE = /^[a-z]{2,3}(-[A-Za-z0-9]{2,8}){0,2}$/;
const EXPORT_TOKEN_SECONDS = 10 * 60;
const LAGOS_OFFSET_MS = 60 * 60 * 1000;
const encoder = new TextEncoder();

export interface AccountStats {
  watchedThisMonth: number;
  minutesLearning: number;
  myListCount: number;
}

export interface ExportFile {
  /** Help centre progress: guides marked done, videos watched, helpful answers (M50-S25). */
  helpCentre: {
    guide: string;
    guideDoneAt: string | null;
    videoWatchedAt: string | null;
    helpful: boolean | null;
  }[];
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
    /** This profile's ratings: 1 Not for me, 2 Like, 3 Love as stored (M44). */
    ratings: Array<{ title: string; slug: string; kind: 'video' | 'series'; value: number; ratedAt: string }>;
    /** The notices shown to this profile (M44). Kids profiles have none. */
    notices: Array<{ kind: string; title: string; body: string; createdAt: string; read: boolean }>;
  }>;
  /** The account notification choices. The sealed email address is never exported (M44). */
  notificationPrefs: {
    bell: boolean;
    newEpisodes: boolean;
    newVideos: boolean;
    emailFrequency: string;
    emailConsentedAt: string | null;
  };
  /** Sign in history, newest first. Country, outcome and a device name only, never an address (M49). */
  signIns: Array<{ at: string; outcome: string; country: string | null; device: string }>;
  /** The linked Google sign in: the masked address and when it was linked. Null when not linked (M49). */
  linkedSignIn: { google: { hint: string; linkedAt: string } | null };
  /** Gifts made while signed in to this account. Amounts and status only, never the sealed contact fields (M48). */
  donations: Array<{
    reference: string;
    kind: string;
    status: string;
    currency: string;
    amountMinor: number;
    createdAt: string;
    paidAt: string | null;
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
    autoplayPreviews:
      typeof stored.autoplayPreviews === 'boolean'
        ? stored.autoplayPreviews
        : DEFAULT_PLAYBACK.autoplayPreviews,
    quality: pick(stored.quality, QUALITIES, DEFAULT_PLAYBACK.quality),
    speed: pick(stored.speed, SPEEDS, DEFAULT_PLAYBACK.speed),
    captionsDefault:
      typeof stored.captionsDefault === 'boolean'
        ? stored.captionsDefault
        : DEFAULT_PLAYBACK.captionsDefault,
    captionSize: pick(stored.captionSize, CAPTION_SIZES, DEFAULT_PLAYBACK.captionSize),
    captionBackground: pick(
      stored.captionBackground,
      CAPTION_BACKGROUNDS,
      DEFAULT_PLAYBACK.captionBackground,
    ),
    captionContrast: pick(
      stored.captionContrast,
      CAPTION_CONTRASTS,
      DEFAULT_PLAYBACK.captionContrast,
    ),
    captionEdge: pick(stored.captionEdge, CAPTION_EDGES, DEFAULT_PLAYBACK.captionEdge),
    captionColor: pick(stored.captionColor, CAPTION_COLORS, DEFAULT_PLAYBACK.captionColor),
    captionLanguage:
      typeof stored.captionLanguage === 'string' && LANGUAGE_CODE.test(stored.captionLanguage)
        ? stored.captionLanguage
        : DEFAULT_PLAYBACK.captionLanguage,
  };
}

function storedPrefs(row: { playbackPrefs: unknown }): Record<string, unknown> {
  return typeof row.playbackPrefs === 'object' && row.playbackPrefs !== null
    ? (row.playbackPrefs as Record<string, unknown>)
    : {};
}

/** Keeps only the fields a device could have stored, each checked like a normal save. Anything else is dropped. */
function legacyPatch(legacy: Record<string, unknown>): Partial<PlaybackSettings> {
  const out: Partial<PlaybackSettings> = {};
  if (typeof legacy.speed === 'number' && SPEEDS.includes(legacy.speed as (typeof SPEEDS)[number]))
    out.speed = legacy.speed;
  if (typeof legacy.captionsDefault === 'boolean') out.captionsDefault = legacy.captionsDefault;
  if (typeof legacy.captionLanguage === 'string' && LANGUAGE_CODE.test(legacy.captionLanguage))
    out.captionLanguage = legacy.captionLanguage;
  if (typeof legacy.dataSaver === 'boolean') out.dataSaver = legacy.dataSaver;
  if (typeof legacy.autoplayNext === 'boolean') out.autoplayNext = legacy.autoplayNext;
  return out;
}

function validatePatch(patch: Partial<PlaybackSettings>): void {
  const bad: Record<string, string[]> = {};
  if (patch.quality !== undefined && !QUALITIES.includes(patch.quality))
    bad.quality = ['Pick a listed quality'];
  if (patch.speed !== undefined && !SPEEDS.includes(patch.speed as (typeof SPEEDS)[number]))
    bad.speed = ['Pick a listed speed'];
  if (patch.captionSize !== undefined && !CAPTION_SIZES.includes(patch.captionSize))
    bad.captionSize = ['Pick a listed size'];
  if (
    patch.captionBackground !== undefined &&
    !CAPTION_BACKGROUNDS.includes(patch.captionBackground)
  )
    bad.captionBackground = ['Pick a listed background'];
  if (patch.captionContrast !== undefined && !CAPTION_CONTRASTS.includes(patch.captionContrast))
    bad.captionContrast = ['Pick a listed contrast'];
  if (patch.captionEdge !== undefined && !CAPTION_EDGES.includes(patch.captionEdge))
    bad.captionEdge = ['Pick a listed edge'];
  if (patch.captionColor !== undefined && !CAPTION_COLORS.includes(patch.captionColor))
    bad.captionColor = ['Pick a listed colour'];
  if (
    patch.captionLanguage !== undefined &&
    (typeof patch.captionLanguage !== 'string' || !LANGUAGE_CODE.test(patch.captionLanguage))
  )
    bad.captionLanguage = ['Pick a language code'];
  for (const key of ['autoplayNext', 'autoplayPreviews', 'dataSaver', 'captionsDefault'] as const) {
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
      const updatedRow = await loadOwnedProfile(tx, actor, profileId);
      const current = readPrefs(updatedRow);
      const next: PlaybackSettings = { ...current, ...patch };
      if (
        !captionColorAllowed({
          size: next.captionSize,
          background: next.captionBackground,
          contrast: next.captionContrast,
          edge: next.captionEdge,
          color: next.captionColor,
        })
      )
        throw new ValidationFailed({
          captionColor: ['Yellow needs a dark or solid background, or high contrast'],
        });
      const [updated] = await tx
        .update(profiles)
        .set({
          autoplayNext: next.autoplayNext,
          dataSaver: next.dataSaver,
          playbackPrefs: {
            ...storedPrefs(updatedRow),
            autoplayPreviews: next.autoplayPreviews,
            quality: next.quality,
            speed: next.speed,
            captionsDefault: next.captionsDefault,
            captionSize: next.captionSize,
            captionBackground: next.captionBackground,
            captionContrast: next.captionContrast,
            captionEdge: next.captionEdge,
            captionColor: next.captionColor,
            captionLanguage: next.captionLanguage,
          },
        })
        .where(and(eq(profiles.id, profileId), eq(profiles.accountId, accountId)))
        .returning();
      if (!updated) throw new NotFound('Profile not found');
      return readPrefs(updated);
    });
  }

  /**
   * One time move of the choices an older version kept in this browser (speed, captions, data saver, autoplay) to
   * the profile. It applies once per profile: the first call writes and marks the profile, later calls change
   * nothing, so a second device cannot overwrite what was saved since.
   */
  async migrateDevicePlayback(
    accountId: string,
    profileId: string,
    legacy: Record<string, unknown>,
  ): Promise<PlaybackSettings> {
    const actor = viewerActor(accountId);
    return withAccount(this.service.db, actor, async (tx) => {
      const row = await loadOwnedProfile(tx, actor, profileId);
      const stored = storedPrefs(row);
      if (stored.deviceMigrated === true) return readPrefs(row);
      const next: PlaybackSettings = { ...readPrefs(row), ...legacyPatch(legacy) };
      const [updated] = await tx
        .update(profiles)
        .set({
          autoplayNext: next.autoplayNext,
          dataSaver: next.dataSaver,
          playbackPrefs: {
            ...stored,
            quality: next.quality,
            speed: next.speed,
            captionsDefault: next.captionsDefault,
            captionSize: next.captionSize,
            captionLanguage: next.captionLanguage,
            deviceMigrated: true,
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
      const [prefs] = await tx
        .select()
        .from(viewerNotificationPrefs)
        .where(eq(viewerNotificationPrefs.accountId, accountId));
      const events = await tx
        .select({
          at: loginEvents.at,
          outcome: loginEvents.outcome,
          country: loginEvents.country,
          userAgent: loginEvents.userAgent,
        })
        .from(loginEvents)
        .where(eq(loginEvents.accountId, accountId))
        .orderBy(desc(loginEvents.at))
        .limit(500);
      const [google] = await tx
        .select({ hint: accountIdentities.emailHint, linkedAt: accountIdentities.linkedAt })
        .from(accountIdentities)
        .where(
          and(eq(accountIdentities.accountId, accountId), eq(accountIdentities.provider, 'google')),
        );
      const gifts = await tx
        .select({
          reference: donations.reference,
          kind: donations.kind,
          status: donations.status,
          currency: donations.currency,
          amountMinor: donations.amountMinor,
          createdAt: donations.createdAt,
          paidAt: donations.paidAt,
        })
        .from(donations)
        .where(eq(donations.accountId, accountId))
        .orderBy(desc(donations.createdAt));
      const help = await tx
        .select()
        .from(helpProgress)
        .where(eq(helpProgress.accountId, accountId))
        .orderBy(asc(helpProgress.articleId));
      const extras = { events, google, gifts, help };
      if (ids.length === 0)
        return { owned, saved: [], progress: [], ratings: [], notices: [], prefs, ...extras };
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
      const ratings = await tx
        .select({
          profileId: titleRatings.profileId,
          value: titleRatings.value,
          ratedAt: titleRatings.ratedAt,
          videoTitle: videos.title,
          videoSlug: videos.slug,
          seriesTitle: series.title,
          seriesSlug: series.slug,
        })
        .from(titleRatings)
        .leftJoin(videos, eq(videos.id, titleRatings.videoId))
        .leftJoin(series, eq(series.id, titleRatings.seriesId))
        .where(inArray(titleRatings.profileId, ids))
        .orderBy(desc(titleRatings.ratedAt));
      const notices = await tx
        .select()
        .from(viewerNotices)
        .where(inArray(viewerNotices.profileId, ids))
        .orderBy(desc(viewerNotices.createdAt));
      return { owned, saved, progress, ratings, notices, prefs, ...extras };
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
        ratings: rows.ratings
          .filter((r) => r.profileId === profile.id)
          .map((r) => ({
            title: r.videoTitle ?? r.seriesTitle ?? '',
            slug: r.videoSlug ?? r.seriesSlug ?? '',
            kind: r.videoTitle !== null ? ('video' as const) : ('series' as const),
            value: r.value,
            ratedAt: r.ratedAt.toISOString(),
          })),
        notices: rows.notices
          .filter((n) => n.profileId === profile.id)
          .map((n) => ({
            kind: n.kind,
            title: n.title,
            body: n.body,
            createdAt: n.createdAt.toISOString(),
            read: n.readAt !== null,
          })),
      });
    }
    const prefs = rows.prefs;
    return {
      exportedAt: this.now().toISOString(),
      account,
      profiles: profilesOut,
      notificationPrefs: {
        bell: prefs?.bell ?? true,
        newEpisodes: prefs?.newEpisodes ?? true,
        newVideos: prefs?.newVideos ?? true,
        emailFrequency: prefs?.emailFrequency ?? 'off',
        emailConsentedAt: prefs?.addressConsentedAt?.toISOString() ?? null,
      },
      signIns: rows.events.map((e) => ({
        at: e.at.toISOString(),
        outcome: e.outcome,
        country: e.country,
        device: deviceLabel(e.userAgent),
      })),
      linkedSignIn: {
        google: rows.google
          ? { hint: rows.google.hint, linkedAt: rows.google.linkedAt.toISOString() }
          : null,
      },
      helpCentre: rows.help.map((r) => ({
        guide: r.articleId,
        guideDoneAt: r.guideDoneAt?.toISOString() ?? null,
        videoWatchedAt: r.videoWatchedAt?.toISOString() ?? null,
        helpful: r.helpful,
      })),
      donations: rows.gifts.map((g) => ({
        reference: g.reference,
        kind: g.kind,
        status: g.status,
        currency: g.currency,
        amountMinor: g.amountMinor,
        createdAt: g.createdAt.toISOString(),
        paidAt: g.paidAt?.toISOString() ?? null,
      })),
    };
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
