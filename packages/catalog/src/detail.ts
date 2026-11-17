import { sql } from 'drizzle-orm';
import { artworkFromRow, type ArtworkDto, type ArtworkRow } from './artwork';
import { rowsOf, uuidList } from './sql';
import { fetchCards, findTitleRefBySlug, type CategoryDto, type TitleCard } from './titles';
import type { Audience, CatalogContext, Tx, TitleKind, TitleRef } from './types';
import { playableVideoSql } from './visibility';

export interface CaptionTrackDto {
  language: string;
  label: string;
  kind: 'captions' | 'subtitles';
  isDefault: boolean;
}

export interface TitleCore {
  card: TitleCard;
  hero: ArtworkDto | null;
  categories: CategoryDto[];
  language: string | null;
  captionTracks: CaptionTrackDto[];
  publishedAt: string | null;
}

export type TitleLookup =
  | { type: 'title'; title: TitleCore }
  | { type: 'redirect'; to: { kind: TitleKind; slug: string; episodeId?: string } };

type HeroRow = ArtworkRow & { id: string };

/** Wide artwork for banners. Falls back to nothing, the card poster is still there. */
export async function fetchHeroArtwork(
  tx: Tx,
  ctx: CatalogContext,
  refs: readonly TitleRef[],
): Promise<Map<string, ArtworkDto>> {
  const result = new Map<string, ArtworkDto>();
  for (const kind of ['video', 'series'] as const) {
    const ids = refs.filter((ref) => ref.kind === kind).map((ref) => ref.id);
    if (ids.length === 0) continue;
    const table = kind === 'video' ? sql`videos` : sql`series`;
    const rows = rowsOf<HeroRow>(
      await tx.execute(sql`
        SELECT x.id, pa.id AS poster_id, pa.alt_text AS poster_alt, pa.placeholder_color AS poster_color,
          pa.width AS poster_width, pa.height AS poster_height, pa.variants AS poster_variants
        FROM ${table} x JOIN assets pa ON pa.id = x.hero_asset_id AND pa.status = 'ready'
        WHERE x.id IN (${uuidList(ids)})`),
    );
    for (const row of rows) {
      const artwork = artworkFromRow(row, ctx.mediaOrigin);
      if (artwork) result.set(row.id, artwork);
    }
  }
  return result;
}

async function loadCore(
  tx: Tx,
  ctx: CatalogContext,
  audience: Audience,
  ref: TitleRef,
): Promise<TitleCore | null> {
  const [card] = await fetchCards(tx, ctx, audience, [ref]);
  if (!card) return null;
  const joinTable = ref.kind === 'video' ? sql`video_categories` : sql`series_categories`;
  const idColumn = ref.kind === 'video' ? sql`video_id` : sql`series_id`;
  const meta = rowsOf<{ language: string | null; published_at: Date | null }>(
    await tx.execute(
      ref.kind === 'video'
        ? sql`SELECT language, coalesce(published_at, publish_at) AS published_at FROM videos WHERE id = ${ref.id}::uuid`
        : sql`SELECT NULL::text AS language, coalesce(published_at, publish_at) AS published_at FROM series WHERE id = ${ref.id}::uuid`,
    ),
  )[0];
  const categories = rowsOf<CategoryDto>(
    await tx.execute(sql`
      SELECT c.id, c.slug, c.name::text AS name, c.description
      FROM ${joinTable} j JOIN categories c ON c.id = j.category_id
      WHERE j.${idColumn} = ${ref.id}::uuid AND c.is_visible ORDER BY c.position, c.name`),
  );
  const tracks = rowsOf<{
    language: string;
    label: string;
    kind: 'captions' | 'subtitles';
    is_default: boolean;
  }>(
    await tx.execute(
      ref.kind === 'video'
        ? sql`SELECT language, label, kind, is_default FROM caption_tracks
            WHERE video_id = ${ref.id}::uuid AND approved_caption_id IS NOT NULL ORDER BY is_default DESC, language`
        : sql`SELECT DISTINCT ON (ct.language) ct.language, ct.label, ct.kind, ct.is_default
            FROM caption_tracks ct JOIN episodes ep ON ep.video_id = ct.video_id JOIN seasons sn ON sn.id = ep.season_id
            WHERE sn.series_id = ${ref.id}::uuid AND ct.approved_caption_id IS NOT NULL ORDER BY ct.language`,
    ),
  );
  const heroes = await fetchHeroArtwork(tx, ctx, [ref]);
  return {
    card,
    hero: heroes.get(ref.id) ?? null,
    categories,
    language: meta?.language ?? null,
    captionTracks: tracks.map((track) => ({
      language: track.language,
      label: track.label,
      kind: track.kind,
      isDefault: track.is_default,
    })),
    publishedAt: meta?.published_at ? new Date(meta.published_at).toISOString() : null,
  };
}

/**
 * Finds a title for the detail page by id or slug. A missing, hidden or kids unsafe title is simply not found, so
 * a hidden title cannot be told apart from one that never existed (M04-S01). An old slug and an episode that
 * became part of a series come back as redirects (M04-S02, M04-S03).
 */
export async function findTitle(
  tx: Tx,
  ctx: CatalogContext,
  audience: Audience,
  key: { id?: string; slug?: string; kind?: TitleKind },
): Promise<TitleLookup | null> {
  let ref: TitleRef | null = null;
  if (key.id !== undefined) {
    const candidates: TitleRef[] = key.kind
      ? [{ kind: key.kind, id: key.id }]
      : [
          { kind: 'video', id: key.id },
          { kind: 'series', id: key.id },
        ];
    for (const candidate of candidates) {
      if ((await fetchCards(tx, ctx, audience, [candidate])).length > 0) {
        ref = candidate;
        break;
      }
    }
  } else if (key.slug !== undefined) {
    ref = await findTitleRefBySlug(tx, ctx, audience, key.slug, key.kind);
  }
  if (ref) {
    const core = await loadCore(tx, ctx, audience, ref);
    if (core) return { type: 'title', title: core };
  }

  const episodeRedirect = await episodeRedirectFor(tx, ctx, audience, key);
  if (episodeRedirect) return episodeRedirect;
  return key.slug === undefined ? null : oldSlugRedirect(tx, ctx, audience, key.slug, key.kind);
}

async function episodeRedirectFor(
  tx: Tx,
  ctx: CatalogContext,
  audience: Audience,
  key: { id?: string; slug?: string },
): Promise<TitleLookup | null> {
  const match =
    key.id !== undefined ? sql`v.id = ${key.id}::uuid` : sql`v.slug = ${key.slug ?? ''}`;
  const row = rowsOf<{ id: string; series_slug: string }>(
    await tx.execute(sql`
      SELECT v.id, se.slug AS series_slug FROM videos v
      JOIN episodes ep ON ep.video_id = v.id JOIN seasons sn ON sn.id = ep.season_id JOIN series se ON se.id = sn.series_id
      WHERE ${match} AND ${playableVideoSql('v', audience, ctx.now())}`),
  )[0];
  return row
    ? { type: 'redirect', to: { kind: 'series', slug: row.series_slug, episodeId: row.id } }
    : null;
}

async function oldSlugRedirect(
  tx: Tx,
  ctx: CatalogContext,
  audience: Audience,
  slug: string,
  kind?: TitleKind,
): Promise<TitleLookup | null> {
  const row = rowsOf<{ video_id: string | null; series_id: string | null }>(
    await tx.execute(sql`SELECT video_id, series_id FROM slug_redirects WHERE old_slug = ${slug}`),
  ).find((candidate) => !kind || (kind === 'video' ? candidate.video_id : candidate.series_id));
  if (!row) return null;
  const ref: TitleRef = row.video_id
    ? { kind: 'video', id: row.video_id }
    : { kind: 'series', id: row.series_id! };
  const [card] = await fetchCards(tx, ctx, audience, [ref]);
  return card ? { type: 'redirect', to: { kind: card.kind, slug: card.slug } } : null;
}
