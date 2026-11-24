import { sql } from 'drizzle-orm';
import { artworkFromRow, type ArtworkDto, type ArtworkRow } from './artwork';
import { rowsOf, uuidList } from './sql';
import type { Audience, CatalogContext, Tx } from './types';
import { playableVideoSql } from './visibility';

export interface EpisodePosition {
  seriesId: string;
  seriesSlug: string;
  seriesTitle: string;
  seasonNumber: number;
  number: number;
}

/** One playable video, standalone or an episode. Episodes carry their place in the series. */
export interface VideoCard {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  durationMs: number;
  kidsSafe: boolean;
  hasCaptions: boolean;
  poster: ArtworkDto | null;
  episode: EpisodePosition | null;
}

interface VideoRow extends ArtworkRow {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  duration_ms: number;
  kids_safe: boolean;
  has_captions: boolean;
  series_id: string | null;
  series_slug: string | null;
  series_title: string | null;
  season_number: number | null;
  episode_number: number | null;
}

const VIDEO_SELECT = sql.raw(`v.id, v.slug, v.title, v.description, v.duration_ms, v.kids_safe,
  (EXISTS (SELECT 1 FROM caption_tracks ct WHERE ct.video_id = v.id AND ct.approved_caption_id IS NOT NULL)
      AND coalesce(v.captions_enabled, NOT EXISTS (SELECT 1 FROM settings st WHERE st.key = 'features.captions_default_available' AND st.value = 'false'::jsonb))) AS has_captions,
  se.id AS series_id, se.slug AS series_slug, se.title AS series_title, sn.number AS season_number, ep.number AS episode_number,
  pa.id AS poster_id, pa.alt_text AS poster_alt, pa.placeholder_color AS poster_color, pa.placeholder_blur AS poster_blur,
  pa.width AS poster_width, pa.height AS poster_height, pa.variants AS poster_variants`);

const VIDEO_JOINS = sql.raw(`LEFT JOIN episodes ep ON ep.video_id = v.id
  LEFT JOIN seasons sn ON sn.id = ep.season_id
  LEFT JOIN series se ON se.id = sn.series_id
  LEFT JOIN assets pa ON pa.id = coalesce(v.poster_asset_id, se.poster_asset_id) AND pa.status = 'ready'`);

function toVideoCard(row: VideoRow, mediaOrigin: string): VideoCard {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    durationMs: row.duration_ms,
    kidsSafe: row.kids_safe,
    hasCaptions: row.has_captions,
    poster: artworkFromRow(row, mediaOrigin),
    episode:
      row.series_id === null
        ? null
        : {
            seriesId: row.series_id,
            seriesSlug: row.series_slug!,
            seriesTitle: row.series_title!,
            seasonNumber: row.season_number!,
            number: row.episode_number!,
          },
  };
}

/** Playable videos by id. Hidden, unpublished, kids unsafe and orphaned episodes are absent from the map. */
export async function fetchVideoCards(
  tx: Tx,
  ctx: CatalogContext,
  audience: Audience,
  ids: readonly string[],
): Promise<Map<string, VideoCard>> {
  if (ids.length === 0) return new Map();
  const result = await tx.execute(sql`
    SELECT ${VIDEO_SELECT} FROM videos v ${VIDEO_JOINS}
    WHERE v.id IN (${uuidList(ids)}) AND ${playableVideoSql('v', audience, ctx.now())}`);
  return new Map(
    rowsOf<VideoRow>(result).map((row) => [row.id, toVideoCard(row, ctx.mediaOrigin)]),
  );
}

/**
 * Playable episodes of the given series in watching order: season number, then episode number (M04-S03).
 * A series that is hidden for this audience has no entry.
 */
export async function listEpisodes(
  tx: Tx,
  ctx: CatalogContext,
  audience: Audience,
  seriesIds: readonly string[],
): Promise<Map<string, VideoCard[]>> {
  const grouped = new Map<string, VideoCard[]>();
  if (seriesIds.length === 0) return grouped;
  const result = await tx.execute(sql`
    SELECT ${VIDEO_SELECT} FROM videos v ${VIDEO_JOINS}
    WHERE se.id IN (${uuidList(seriesIds)}) AND ${playableVideoSql('v', audience, ctx.now())}
    ORDER BY se.id, sn.number, ep.number`);
  for (const row of rowsOf<VideoRow>(result)) {
    const card = toVideoCard(row, ctx.mediaOrigin);
    const list = grouped.get(row.series_id!) ?? [];
    list.push(card);
    grouped.set(row.series_id!, list);
  }
  return grouped;
}

/**
 * Episode video ids in watching order, whatever their publish state. Used to find "the next episode" after a
 * finished one, so a gap left by an unpublished episode is noticed. Ids only, never shown to a viewer.
 */
export async function episodeOrder(
  tx: Tx,
  seriesIds: readonly string[],
): Promise<Map<string, string[]>> {
  const order = new Map<string, string[]>();
  if (seriesIds.length === 0) return order;
  const result = await tx.execute(sql`
    SELECT sn.series_id, ep.video_id FROM episodes ep JOIN seasons sn ON sn.id = ep.season_id
    WHERE sn.series_id IN (${uuidList(seriesIds)})
    ORDER BY sn.series_id, sn.number, ep.number`);
  for (const row of rowsOf<{ series_id: string; video_id: string }>(result)) {
    const list = order.get(row.series_id) ?? [];
    list.push(row.video_id);
    order.set(row.series_id, list);
  }
  return order;
}
