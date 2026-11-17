import { sql, type SQL } from 'drizzle-orm';
import { alias } from './sql';
import type { Audience } from './types';

/**
 * The single source of truth for what a viewer may see (docs/DATA-MODEL.md section 5.1). Every viewer read, write
 * and playback authorization builds on these fragments, so a new endpoint cannot forget the kids rule.
 * `a` is the alias of the videos or series table in the surrounding query.
 */
function published(a: string, now: Date): SQL {
  const t = alias(a);
  return sql`(${t}.publish_state = 'published' OR (${t}.publish_state = 'scheduled' AND ${t}.publish_at <= ${now}::timestamptz))`;
}

export function liveVideoSql(a: string, audience: Audience, now: Date): SQL {
  const t = alias(a);
  const kids = audience.kids ? sql` AND ${t}.kids_safe` : sql``;
  return sql`(${t}.deleted_at IS NULL AND ${t}.status = 'ready' AND ${published(a, now)}${kids})`;
}

/** A series is live when it is published and has at least one live episode (M28, M04-S03). */
export function liveSeriesSql(a: string, audience: Audience, now: Date): SQL {
  const t = alias(a);
  const kids = audience.kids ? sql` AND ${t}.kids_safe` : sql``;
  return sql`(${t}.deleted_at IS NULL AND ${published(a, now)}${kids} AND EXISTS (
    SELECT 1 FROM seasons lsn
      JOIN episodes lep ON lep.season_id = lsn.id
      JOIN videos lev ON lev.id = lep.video_id
    WHERE lsn.series_id = ${t}.id AND ${liveVideoSql('lev', audience, now)}))`;
}

/** A video a viewer can open or play: live itself, and when it is an episode, its series is live too. */
export function playableVideoSql(a: string, audience: Audience, now: Date): SQL {
  const t = alias(a);
  return sql`(${liveVideoSql(a, audience, now)} AND (${t}.kind = 'standalone' OR EXISTS (
    SELECT 1 FROM episodes pep
      JOIN seasons psn ON psn.id = pep.season_id
      JOIN series pse ON pse.id = psn.series_id
    WHERE pep.video_id = ${t}.id AND ${liveSeriesSql('pse', audience, now)})))`;
}
