import { sql } from 'drizzle-orm';
import type { Tx } from '../types';
import { rowsOf } from '../sql';

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export type SlugKind = 'video' | 'series';

/** Why a slug cannot be used, in words an editor can act on, or null when it is fine. */
export function slugProblem(slug: string): string | null {
  if (slug.length < 3 || slug.length > 120) return 'Use 3 to 120 characters for the address.';
  if (!SLUG.test(slug)) return 'Use lower case letters, numbers and single hyphens only.';
  return null;
}

/**
 * Changes a title's address and keeps the old one working as a redirect (M04-S02). Returns an error message when
 * the new address is invalid or belongs to another live title, and the change is not made. Call it inside the
 * transaction that edits the row, with the row locked.
 */
export async function changeSlug(
  tx: Tx,
  kind: SlugKind,
  id: string,
  currentSlug: string,
  nextSlug: string,
): Promise<string | null> {
  if (nextSlug === currentSlug) return null;
  const problem = slugProblem(nextSlug);
  if (problem) return problem;
  const table = kind === 'video' ? sql.raw('videos') : sql.raw('series');
  const taken = rowsOf<{ id: string }>(
    await tx.execute(
      sql`SELECT id FROM ${table} WHERE slug = ${nextSlug} AND deleted_at IS NULL AND id <> ${id}::uuid LIMIT 1`,
    ),
  );
  if (taken.length > 0) return 'That address is already used by another title.';
  const target = kind === 'video' ? sql.raw('video_id') : sql.raw('series_id');
  // The new address may be one this title used before. It is live again, so it stops being a redirect.
  await tx.execute(sql`DELETE FROM slug_redirects WHERE old_slug = ${nextSlug} AND ${target} = ${id}::uuid`);
  await tx.execute(sql`UPDATE ${table} SET slug = ${nextSlug} WHERE id = ${id}::uuid`);
  await tx.execute(
    kind === 'video'
      ? sql`INSERT INTO slug_redirects (old_slug, video_id) VALUES (${currentSlug}, ${id}::uuid)
          ON CONFLICT (old_slug) WHERE video_id IS NOT NULL DO UPDATE SET video_id = EXCLUDED.video_id`
      : sql`INSERT INTO slug_redirects (old_slug, series_id) VALUES (${currentSlug}, ${id}::uuid)
          ON CONFLICT (old_slug) WHERE series_id IS NOT NULL DO UPDATE SET series_id = EXCLUDED.series_id`,
  );
  return null;
}
