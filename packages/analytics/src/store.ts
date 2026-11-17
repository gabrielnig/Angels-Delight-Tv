import { sql } from 'drizzle-orm';
import type { CounterBump, EventStore, ViewUpsert } from './ingest';
import { rowsOf, type SqlExecutor } from './sql';

/** Postgres implementation of the ingest store. Runs as ad_app in the web process. */
export function createPgEventStore(db: SqlExecutor): EventStore {
  return {
    async upsertView(row: ViewUpsert) {
      // A play can only be advanced by events for the same video. Unknown videos insert nothing.
      const rows = rowsOf<{ created: boolean }>(
        await db.execute(sql`
          INSERT INTO view_events AS e
            (play_id, video_id, profile_id, audience, started_at, watched_ms, completed, max_height,
             country, viewer_hash, device_class, save_data)
          SELECT ${row.playId}::uuid, ${row.videoId}::uuid, ${row.profileId}::uuid, ${row.audience},
                 ${row.startedAt.toISOString()}::timestamptz, ${row.watchedMs}, ${row.completed},
                 ${row.maxHeight}::smallint, ${row.country}, ${row.viewerHash}, ${row.deviceClass},
                 ${row.saveData}
          WHERE EXISTS (SELECT 1 FROM videos WHERE id = ${row.videoId}::uuid)
          ON CONFLICT (play_id) DO UPDATE SET
            watched_ms = GREATEST(e.watched_ms, EXCLUDED.watched_ms),
            completed = e.completed OR EXCLUDED.completed,
            max_height = GREATEST(e.max_height, EXCLUDED.max_height)
          WHERE e.video_id = EXCLUDED.video_id
          RETURNING (xmax = 0) AS created`),
      );
      return { created: rows[0]?.created === true };
    },

    async bump(entry: CounterBump) {
      await db.execute(sql`
        INSERT INTO analytics_counters AS c (day, kind, key, count)
        VALUES (${entry.day}::date, ${entry.kind}, ${entry.key}, ${entry.by ?? 1})
        ON CONFLICT (day, kind, key) DO UPDATE SET count = c.count + EXCLUDED.count`);
    },
  };
}
