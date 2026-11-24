import { sql } from 'drizzle-orm';
import type { Database } from '@ad/db';
import { rowsOf } from './sql';

export interface SitemapRow {
  slug: string;
  lastmod: Date;
}

export interface SitemapRows {
  videos: SitemapRow[];
  series: SitemapRow[];
  categories: SitemapRow[];
}

/** Hard cap per kind. The sitemap protocol allows 50,000 urls per file, and the web app splits long lists. */
export const SITEMAP_ROW_LIMIT = 50_000;

/**
 * Standalone videos are kids only when the editor chose Kids, or when an older row has no suitability and the
 * kids flag is set (the same derivation the admin screen uses). R26: search engines do not index them.
 */
const KIDS_ONLY_VIDEO = sql`(v.suitability IS NOT DISTINCT FROM 'kids' OR (v.suitability IS NULL AND v.kids_safe))`;

const PUBLISHED = (alias: string, now: Date) =>
  sql.raw(
    `(${alias}.publish_state = 'published' OR (${alias}.publish_state = 'scheduled' AND ${alias}.publish_at <= '${now.toISOString()}'::timestamptz))`,
  );

function toDate(value: unknown): Date {
  return value instanceof Date ? value : new Date(String(value));
}

type Raw = { slug: string; lastmod: Date | string };

/**
 * Everything a crawler should see, in one pass per kind. Only live content: published (or scheduled and due), not
 * trashed, encoded and ready. Kids only titles are left out (R26). Redirect slugs never appear because they live
 * in their own table. Episodes are left out because they are listed through their series.
 * Ordered by slug so builds are stable.
 */
export async function listSitemapRows(db: Database, now: Date): Promise<SitemapRows> {
  const videoRows = rowsOf<Raw>(
    await db.execute(sql`
      SELECT v.slug, GREATEST(v.updated_at, COALESCE(v.published_at, v.updated_at)) AS lastmod
      FROM videos v
      WHERE v.kind = 'standalone' AND v.deleted_at IS NULL AND v.status = 'ready'
        AND ${PUBLISHED('v', now)} AND NOT ${KIDS_ONLY_VIDEO}
      ORDER BY v.slug
      LIMIT ${SITEMAP_ROW_LIMIT}`),
  );
  const seriesRows = rowsOf<Raw>(
    await db.execute(sql`
      SELECT s.slug, GREATEST(s.updated_at, COALESCE(s.published_at, s.updated_at),
        COALESCE((SELECT max(ev.updated_at) FROM seasons sn
          JOIN episodes ep ON ep.season_id = sn.id
          JOIN videos ev ON ev.id = ep.video_id
          WHERE sn.series_id = s.id AND ev.deleted_at IS NULL), s.updated_at)) AS lastmod
      FROM series s
      WHERE s.deleted_at IS NULL AND ${PUBLISHED('s', now)}
        AND EXISTS (
          SELECT 1 FROM seasons sn
            JOIN episodes ep ON ep.season_id = sn.id
            JOIN videos v ON v.id = ep.video_id
          WHERE sn.series_id = s.id AND v.deleted_at IS NULL AND v.status = 'ready'
            AND ${PUBLISHED('v', now)} AND NOT ${KIDS_ONLY_VIDEO})
      ORDER BY s.slug
      LIMIT ${SITEMAP_ROW_LIMIT}`),
  );
  const categoryRows = rowsOf<Raw>(
    await db.execute(sql`
      SELECT c.slug, c.updated_at AS lastmod
      FROM categories c
      WHERE c.is_visible AND (
        EXISTS (
          SELECT 1 FROM video_categories vc JOIN videos v ON v.id = vc.video_id
          WHERE vc.category_id = c.id AND v.kind = 'standalone' AND v.deleted_at IS NULL
            AND v.status = 'ready' AND ${PUBLISHED('v', now)} AND NOT ${KIDS_ONLY_VIDEO})
        OR EXISTS (
          SELECT 1 FROM series_categories sc JOIN series s ON s.id = sc.series_id
          WHERE sc.category_id = c.id AND s.deleted_at IS NULL AND ${PUBLISHED('s', now)}))
      ORDER BY c.slug
      LIMIT ${SITEMAP_ROW_LIMIT}`),
  );
  const map = (r: Raw): SitemapRow => ({ slug: r.slug, lastmod: toDate(r.lastmod) });
  return {
    videos: videoRows.map(map),
    series: seriesRows.map(map),
    categories: categoryRows.map(map),
  };
}
