import {
  DEFAULT_PREFERENCES,
  normalizeChapters,
  normalizeMarkers,
  normalizeCaptionStyle,
  type CaptionTrack,
  type RelatedItem,
} from '@ad/player';
import { findTitle } from '@ad/catalog';
import { withAccount } from '@ad/db';
import { isUuid, NotFound } from '@ad/shared';
import type { PublishedExtras } from '@ad/video';
import {
  catalogContext,
  getTitleDetail,
  guestTitleDetail,
  loadOwnedProfile,
  type SeriesDetailDto,
  type TitleCardDto,
  type TitleDetailDto,
  type ViewerContext as ServiceContext,
} from '@ad/viewer';
import type {
  NextVideo,
  PlaybackData,
  Tint,
  UpNextTileData,
  ViewerContext,
  WatchData,
  WatchLookup,
  WatchVideo,
} from '../../lib/data/playback';
import type { PlaybackSettings } from '../../lib/data/types';
import { viewerActor } from './actor';
import { toThumb } from './mappers';

const TINTS: Tint[] = ['sky', 'mint', 'lemon', 'peach', 'lavender'];
const UP_NEXT_TILES = 5;
const RELATED_ITEMS = 4;

export function durationLabel(seconds: number): string {
  if (seconds < 60) return `${seconds} sec`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s === 0 ? `${m} min` : `${m} min ${s} sec`;
}

const secondsOf = (ms: number) => Math.round(ms / 1000);

/**
 * Watch page data on the real viewer services. The audience comes from the stored profile, never from the
 * `kids` flag the caller passes, and every read goes through the same visibility rules as the rest of the site.
 * Approved caption tracks come from `captionsFor` and point at the media origin, where `cap/` files are public and
 * immutable (the same urls the playback session lists). Without it captions are empty.
 */
/** An approved caption track as the playback store lists it. `key` is the object key under the media origin. */
export interface ApprovedCaptionRow {
  language: string;
  label: string;
  isDefault: boolean;
  key: string;
}

export class RealPlaybackData implements PlaybackData {
  constructor(
    private readonly service: ServiceContext,
    private readonly settings: (accountId: string, profileId: string) => Promise<PlaybackSettings>,
    private readonly captionsFor: (
      videoId: string,
    ) => Promise<ApprovedCaptionRow[]> = async () => [],
    /** Key of the seek preview map under the media origin, or null. */
    private readonly spriteFor: (videoId: string) => Promise<string | null> = async () => null,
    /** Skip windows and chapters. Takes no viewer, so guests and accounts share it (M43, R01). */
    private readonly extrasFor: (videoId: string) => Promise<PublishedExtras> = async () => ({
      markers: {},
      chapters: [],
    }),
  ) {}

  private async detail(
    accountId: string,
    profileId: string,
    key: { id: string } | { slug: string; kind: 'series' },
  ): Promise<TitleDetailDto | null> {
    try {
      return await getTitleDetail(this.service, viewerActor(accountId), { profileId, ...key });
    } catch (error) {
      if (error instanceof NotFound) return null;
      throw error;
    }
  }

  /** The same lookup for a guest: an audience and no account (M40, D-G10). */
  private async guestDetail(
    kids: boolean,
    key: { id: string } | { slug: string; kind: 'series' },
  ): Promise<TitleDetailDto | null> {
    try {
      return await guestTitleDetail(this.service, { kids }, key);
    } catch (error) {
      if (error instanceof NotFound) return null;
      throw error;
    }
  }

  /** True when a grown-up could open this id. Used to tell "not for kids" from "not there". */
  private async existsForAdults(id: string): Promise<boolean> {
    const found = await this.service.db.transaction((tx) =>
      findTitle(tx, catalogContext(this.service), { kids: false }, { id }),
    );
    return found !== null;
  }

  /**
   * A guest sees the watch page for any published title in their audience. Nothing personal is read: no saved
   * place (the device keeps it), no My List state, default preferences (the device keeps those too).
   */
  private async guestWatch(videoId: string, kids: boolean): Promise<WatchLookup> {
    const found = await this.guestDetail(kids, { id: videoId });
    if (!found) {
      return kids && (await this.existsForAdults(videoId))
        ? { status: 'kids-blocked' }
        : { status: 'not-found' };
    }
    const data =
      found.type === 'video'
        ? this.forStandalone(found, true)
        : found.type === 'redirect' && found.to.kind === 'series' && found.to.episodeId
          ? await this.forEpisode(
              (key) => this.guestDetail(kids, key),
              found.to.slug,
              found.to.episodeId,
            )
          : null;
    if (!data) return { status: 'not-found' };
    return {
      status: 'ok',
      data: {
        ...(await this.withMedia(videoId, data)),
        preferences: { ...DEFAULT_PREFERENCES, captionsOn: kids, autoplayNext: !kids },
        captionStyle: normalizeCaptionStyle({}),
      },
    };
  }

  private async withMedia(
    videoId: string,
    data: Omit<WatchData, 'preferences' | 'captionStyle'>,
  ): Promise<Omit<WatchData, 'preferences' | 'captionStyle'>> {
    const origin = this.service.mediaOrigin.replace(/\/+$/, '');
    const captions: CaptionTrack[] = (await this.captionsFor(videoId)).map((track) => ({
      id: track.language,
      language: track.language,
      label: track.label,
      src: `${origin}/${track.key}`,
      status: 'approved',
    }));
    const spriteKey = await this.spriteFor(videoId);
    const extras = await this.extrasFor(videoId);
    const duration = data.video.durationSeconds;
    const toSeconds = (ms: number) => ms / 1000;
    // Windows and chapters past the duration are dropped here, so a re-cut video never breaks the page.
    const markers = normalizeMarkers(
      Object.fromEntries(
        Object.entries(extras.markers).map(([kind, w]) => [
          kind,
          { start: toSeconds(w.startMs), end: w.endMs === null ? null : toSeconds(w.endMs) },
        ]),
      ),
      duration,
    );
    const chapters = normalizeChapters(
      extras.chapters.map((c) => ({ start: toSeconds(c.startMs), title: c.title })),
      duration,
    );
    return {
      ...data,
      markers,
      chapters,
      captions,
      ...(spriteKey ? { spriteUrl: `${origin}/${spriteKey}` } : {}),
    };
  }

  async getWatchData(videoId: string, viewer: ViewerContext): Promise<WatchLookup> {
    if (viewer.guest)
      return isUuid(videoId) ? this.guestWatch(videoId, viewer.kids) : { status: 'not-found' };
    if (!viewer.accountId || !isUuid(videoId)) return { status: 'not-found' };
    const { accountId, profileId } = viewer;
    const actor = viewerActor(accountId);

    let isKids: boolean;
    try {
      isKids = await withAccount(
        this.service.db,
        actor,
        async (tx) => (await loadOwnedProfile(tx, actor, profileId)).isKids,
      );
    } catch (error) {
      if (error instanceof NotFound) return { status: 'not-found' };
      throw error;
    }

    const found = await this.detail(accountId, profileId, { id: videoId });
    if (!found) {
      return isKids && (await this.existsForAdults(videoId))
        ? { status: 'kids-blocked' }
        : { status: 'not-found' };
    }

    const [prefs, data] = await Promise.all([
      this.settings(accountId, profileId),
      found.type === 'video'
        ? this.forStandalone(found)
        : found.type === 'redirect' && found.to.kind === 'series' && found.to.episodeId
          ? this.forEpisode(
              (key) => this.detail(accountId, profileId, key),
              found.to.slug,
              found.to.episodeId,
            )
          : null,
    ]);
    if (!data) return { status: 'not-found' };
    return {
      status: 'ok',
      data: {
        ...(await this.withMedia(videoId, data)),
        preferences: {
          ...DEFAULT_PREFERENCES,
          captionsOn: isKids || prefs.captionsDefault,
          rate: prefs.speed,
          captionLanguage: prefs.captionLanguage,
          dataSaver: prefs.dataSaver,
          autoplayNext: prefs.autoplayNext,
        },
        captionStyle: normalizeCaptionStyle({
          size: prefs.captionSize,
          background: prefs.captionBackground,
          contrast: prefs.captionContrast,
          edge: prefs.captionEdge,
          color: prefs.captionColor,
        }),
      },
    };
  }

  private forStandalone(
    detail: Extract<TitleDetailDto, { type: 'video' }>,
    guest = false,
  ): Omit<WatchData, 'preferences' | 'captionStyle'> {
    const category = detail.categories[0]?.name ?? '';
    const card = detail.card;
    const video: WatchVideo = {
      id: card.id,
      title: card.title,
      description: card.description ?? '',
      durationSeconds: secondsOf(card.durationMs ?? 0),
      posterUrl: toThumb(card.poster)?.src ?? null,
      categoryLabel: category,
      kidsSafe: card.kidsSafe,
      series: null,
      backHref: `/title/${card.slug}`,
    };
    const tiles = tilesFrom(detail.related, category);
    const candidates = nextCandidates(detail.related, card.id, category);
    return {
      video,
      captions: [],
      saved: detail.progress
        ? {
            positionSeconds: secondsOf(detail.progress.positionMs),
            finished: detail.progress.completed,
          }
        : null,
      next: candidates[0] ?? null,
      // A guest keeps finished titles on the device, so the device picks from this list (M40, M08-S13 AC4).
      ...(guest ? { nextCandidates: candidates } : {}),
      upNext: tiles,
      related: relatedFrom(tiles),
      inMyList: card.inMyList,
    };
  }

  private async forEpisode(
    lookup: (key: { slug: string; kind: 'series' }) => Promise<TitleDetailDto | null>,
    seriesSlug: string,
    episodeId: string,
  ): Promise<Omit<WatchData, 'preferences' | 'captionStyle'> | null> {
    const found = await lookup({ slug: seriesSlug, kind: 'series' });
    if (!found || found.type !== 'series') return null;
    const flat = flatEpisodes(found);
    const index = flat.findIndex((e) => e.video.id === episodeId);
    const current = flat[index];
    if (!current) return null;
    const next = flat[index + 1];
    const label = (e: (typeof flat)[number]) => `S${e.season} E${e.video.episode?.number ?? 0}`;
    const category = found.categories[0]?.name ?? '';

    const video: WatchVideo = {
      id: current.video.id,
      title: current.video.title,
      description: current.video.description ?? '',
      durationSeconds: secondsOf(current.video.durationMs),
      posterUrl: toThumb(current.video.poster)?.src ?? null,
      categoryLabel: category || found.card.title,
      kidsSafe: current.video.kidsSafe,
      series: {
        id: found.card.id,
        title: found.card.title,
        episodeLabel: label(current),
        lastEpisode: next === undefined,
        href: `/series/${found.card.slug}`,
      },
      backHref: `/series/${found.card.slug}`,
    };
    const nextVideo: NextVideo | null = next
      ? {
          id: next.video.id,
          title: next.video.title,
          posterUrl: toThumb(next.video.poster)?.src,
          meta: `${found.card.title}, ${label(next)}, ${durationLabel(secondsOf(next.video.durationMs))}`,
          href: `/watch/${next.video.id}`,
        }
      : null;
    const later: UpNextTileData[] = flat
      .slice(index + 1, index + 1 + UP_NEXT_TILES)
      .map((e, i) => ({
        id: e.video.id,
        title: e.video.title,
        tag: found.card.title,
        durationLabel: durationLabel(secondsOf(e.video.durationMs)),
        href: `/watch/${e.video.id}`,
        tint: TINTS[i % TINTS.length] as Tint,
      }));
    const tiles = later.length > 0 ? later : tilesFrom(found.related, category);
    return {
      video,
      captions: [],
      saved: current.progress
        ? { positionSeconds: secondsOf(current.progress.positionMs), finished: current.completed }
        : null,
      next: nextVideo,
      upNext: tiles,
      related: relatedFrom(tiles),
      inMyList: found.card.inMyList,
    };
  }
}

function flatEpisodes(detail: SeriesDetailDto) {
  return detail.seasons.flatMap((season) =>
    season.episodes.map((e) => ({
      season: season.number,
      video: e.video,
      progress: e.progress,
      completed: e.watched,
    })),
  );
}

function tilesFrom(cards: readonly TitleCardDto[], tag: string): UpNextTileData[] {
  return cards
    .filter((card) => card.kind === 'video')
    .slice(0, UP_NEXT_TILES)
    .map((card, i) => ({
      id: card.id,
      title: card.title,
      tag,
      durationLabel: durationLabel(secondsOf(card.durationMs ?? 0)),
      href: `/watch/${card.id}`,
      tint: TINTS[i % TINTS.length] as Tint,
    }));
}

/**
 * Up next for a standalone video (M08-S13 AC4): the related titles in order, without the current one and without
 * anything this profile has finished. The related list already follows the viewer's audience, so a kids profile
 * never sees a title that is not kids safe. Guests have no progress here, the device filters their copy.
 */
export function nextCandidates(
  related: readonly TitleCardDto[],
  currentId: string,
  category: string,
): NextVideo[] {
  return related
    .filter((card) => card.kind === 'video' && card.id !== currentId && !card.progress?.completed)
    .slice(0, UP_NEXT_TILES)
    .map((card) => ({
      id: card.id,
      title: card.title,
      posterUrl: toThumb(card.poster)?.src,
      meta: [category, durationLabel(secondsOf(card.durationMs ?? 0))].filter(Boolean).join(', '),
      href: `/watch/${card.id}`,
    }));
}

function relatedFrom(tiles: readonly UpNextTileData[]): RelatedItem[] {
  return tiles.slice(0, RELATED_ITEMS).map((t) => ({ id: t.id, title: t.title, href: t.href }));
}
