import type { Database } from '@ad/db';
import { sql } from 'drizzle-orm';

/**
 * Viewer notices (L5, M44-S12, S13). The fanout claims videos that just went live and writes one notice per
 * profile. The claim and the notices share one transaction, so a crash leaves the video unclaimed and a retry
 * starts clean. Re-running it with nothing new does nothing.
 */

export const NOTICE_TIMEZONE = 'Africa/Lagos';
/** A profile follows a series it watched within this many days (M44-S12). */
export const FOLLOW_DAYS = 120;
export const NOTICE_KEEP_DAYS = 60;
export const NOTICE_KEEP_PER_PROFILE = 100;
const BODY_TITLES = 3;

export interface FanoutHooks {
  /** Runs after every notice is written and before the commit. Tests use it to simulate a crash. */
  beforeCommit?: () => void | Promise<void>;
}

export interface FanoutResult {
  claimed: number;
  notices: number;
}

function rowsOf<T>(result: unknown): T[] {
  return Array.isArray(result) ? (result as T[]) : (((result as { rows?: T[] }).rows ?? []) as T[]);
}

function lagosDate(now: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: NOTICE_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const pick = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${pick('year')}-${pick('month')}-${pick('day')}`;
}

interface Claimed {
  id: string;
  kind: string;
  slug: string;
  title: string;
  rank: number;
}

interface Follower {
  profile_id: string;
  max_rank: number;
}

interface NoticeDraft {
  profileId: string;
  kind: 'new_episode' | 'new_video';
  key: string;
  href: string;
  seriesId: string | null;
  videoId: string | null;
  count: number;
  rank: number;
  seriesTitle: string;
  titles: string[];
}

function episodeTitle(count: number, series: string): string {
  return count === 1 ? `New episode of ${series}` : `${count} new episodes of ${series}`;
}

function videoTitle(count: number, first: string): string {
  return count === 1 ? `New video: ${first}` : `${count} new videos`;
}

const LIVE = (alias: string, stamp: string) =>
  sql.raw(
    `(${alias}.deleted_at IS NULL AND (${alias}.publish_state = 'published' OR (${alias}.publish_state = 'scheduled' AND ${alias}.publish_at <= '${stamp}'::timestamptz)))`,
  );

export async function fanoutNotices(
  db: Database,
  now: Date = new Date(),
  hooks: FanoutHooks = {},
): Promise<FanoutResult> {
  const stamp = now.toISOString();
  const day = lagosDate(now);
  return db.transaction(async (tx) => {
    // The widest audience: any live video. Episodes also need a live series, or they wait for it.
    const claimed = rowsOf<Claimed>(
      await tx.execute(sql`
        UPDATE videos v SET announced_at = ${stamp}::timestamptz
        WHERE v.announced_at IS NULL AND v.status = 'ready' AND ${LIVE('v', stamp)}
          AND (v.kind <> 'episode' OR EXISTS (
            SELECT 1 FROM episodes e
              JOIN seasons s ON s.id = e.season_id
              JOIN series se ON se.id = s.series_id
            WHERE e.video_id = v.id AND ${LIVE('se', stamp)}))
        RETURNING v.id, v.kind, v.slug, v.title,
          coalesce(v.maturity_rank, CASE WHEN v.kids_safe THEN 0 ELSE 4 END)::int AS rank`),
    );
    if (claimed.length === 0) {
      await hooks.beforeCommit?.();
      return { claimed: 0, notices: 0 };
    }

    const drafts: NoticeDraft[] = [];
    const episodes = claimed.filter((c) => c.kind === 'episode');
    if (episodes.length > 0) {
      const ids = sql.join(
        episodes.map((e) => sql`${e.id}::uuid`),
        sql`, `,
      );
      const links = rowsOf<{ video_id: string; series_id: string; slug: string; title: string; srank: number }>(
        await tx.execute(sql`
          SELECT e.video_id, se.id AS series_id, se.slug, se.title,
            coalesce(se.maturity_rank, CASE WHEN se.kids_safe THEN 0 ELSE 4 END)::int AS srank
          FROM episodes e
            JOIN seasons s ON s.id = e.season_id
            JOIN series se ON se.id = s.series_id
          WHERE e.video_id IN (${ids})`),
      );
      const rankOf = new Map(episodes.map((e) => [e.id, e.rank]));
      const bySeries = new Map<string, { slug: string; title: string; ranks: number[] }>();
      for (const link of links) {
        const entry = bySeries.get(link.series_id) ?? { slug: link.slug, title: link.title, ranks: [] };
        // A profile needs both the series and the episode inside its limit.
        entry.ranks.push(Math.max(rankOf.get(link.video_id) ?? 4, link.srank));
        bySeries.set(link.series_id, entry);
      }
      const since = new Date(now.getTime() - FOLLOW_DAYS * 86_400_000).toISOString();
      for (const [seriesId, series] of bySeries) {
        const followers = rowsOf<Follower>(
          await tx.execute(sql`SELECT * FROM notice_followers(${seriesId}::uuid, ${since}::timestamptz)`),
        );
        for (const follower of followers) {
          const visible = series.ranks.filter((r) => r <= follower.max_rank);
          const count = visible.length;
          if (count === 0) continue;
          drafts.push({
            profileId: follower.profile_id,
            kind: 'new_episode',
            key: `episode:${seriesId}:${follower.profile_id}:${day}`,
            href: `/series/${series.slug}`,
            seriesId,
            videoId: null,
            count,
            rank: Math.max(...visible),
            seriesTitle: series.title,
            titles: [],
          });
        }
      }
    }

    const standalone = claimed.filter((c) => c.kind !== 'episode').sort((a, b) => a.title.localeCompare(b.title));
    if (standalone.length > 0) {
      const audience = rowsOf<Follower>(await tx.execute(sql`SELECT * FROM notice_video_audience()`));
      for (const member of audience) {
        const visible = standalone.filter((v) => v.rank <= member.max_rank);
        if (visible.length === 0) continue;
        drafts.push({
          profileId: member.profile_id,
          kind: 'new_video',
          key: `video:${member.profile_id}:${day}`,
          href: visible.length === 1 ? `/title/${visible[0]?.slug}` : '/browse',
          seriesId: null,
          videoId: visible.length === 1 ? (visible[0]?.id ?? null) : null,
          count: visible.length,
          rank: Math.max(...visible.map((v) => v.rank)),
          seriesTitle: '',
          titles: visible.map((v) => v.title),
        });
      }
    }

    let written = 0;
    for (let i = 0; i < drafts.length; i += 500) {
      written += await writeDrafts(tx, drafts.slice(i, i + 500), now);
    }
    await hooks.beforeCommit?.();
    return { claimed: claimed.length, notices: written };
  });
}

type Tx = Parameters<Parameters<Database['transaction']>[0]>[0];

/** Inserts the notices. A second batch on the same day grows the existing notice and marks it unread again. */
async function writeDrafts(tx: Tx, drafts: NoticeDraft[], now: Date): Promise<number> {
  if (drafts.length === 0) return 0;
  const keys = JSON.stringify(drafts.map((d) => ({ p: d.profileId, k: d.key })));
  const existing = rowsOf<{ profile_id: string; dedupe_key: string; item_count: number; body: string; rank: number }>(
    await tx.execute(sql`
      SELECT n.profile_id, n.dedupe_key, n.item_count, n.body, n.rank
      FROM viewer_notices n
      JOIN jsonb_to_recordset(${keys}::jsonb) AS x(p uuid, k text) ON x.p = n.profile_id AND x.k = n.dedupe_key`),
  );
  const before = new Map(existing.map((e) => [`${e.profile_id}|${e.dedupe_key}`, e]));
  const payload = drafts.map((d) => {
    const old = before.get(`${d.profileId}|${d.key}`);
    const count = d.count + (old?.item_count ?? 0);
    const titles = [
      ...new Set([...(old?.body ? old.body.split(', ') : []), ...d.titles]),
    ].slice(0, BODY_TITLES);
    return {
      profile_id: d.profileId,
      kind: d.kind,
      title: d.kind === 'new_episode' ? episodeTitle(count, d.seriesTitle) : videoTitle(count, titles[0] ?? ''),
      body: d.kind === 'new_video' ? titles.join(', ') : '',
      href: count > 1 && d.kind === 'new_video' ? '/browse' : d.href,
      series_id: d.seriesId,
      video_id: count > 1 ? null : d.videoId,
      item_count: count,
      rank: Math.max(d.rank, old?.rank ?? 0),
      dedupe_key: d.key,
    };
  });
  const result = rowsOf<{ id: string }>(
    await tx.execute(sql`
      INSERT INTO viewer_notices (profile_id, kind, title, body, href, series_id, video_id, item_count, rank, dedupe_key, created_at)
      SELECT x.profile_id, x.kind, x.title, x.body, x.href, x.series_id, x.video_id, x.item_count, x.rank, x.dedupe_key,
        ${now.toISOString()}::timestamptz
      FROM jsonb_to_recordset(${JSON.stringify(payload)}::jsonb) AS x(
        profile_id uuid, kind text, title text, body text, href text, series_id uuid, video_id uuid,
        item_count int, rank smallint, dedupe_key text)
      ON CONFLICT (profile_id, dedupe_key) DO UPDATE SET
        title = EXCLUDED.title, body = EXCLUDED.body, href = EXCLUDED.href, video_id = EXCLUDED.video_id,
        item_count = EXCLUDED.item_count, rank = EXCLUDED.rank, created_at = EXCLUDED.created_at, read_at = NULL
      RETURNING id`),
  );
  return result.length;
}

/** Notices live 60 days and at most 100 per profile (M44-S25). Safe to run twice. */
export async function pruneNotices(db: Database, now: Date = new Date()): Promise<{ deleted: number }> {
  const cutoff = new Date(now.getTime() - NOTICE_KEEP_DAYS * 86_400_000).toISOString();
  const gone = rowsOf<{ id: string }>(
    await db.execute(sql`
      DELETE FROM viewer_notices
      WHERE created_at < ${cutoff}::timestamptz
         OR id IN (
           SELECT id FROM (
             SELECT id, row_number() OVER (PARTITION BY profile_id ORDER BY created_at DESC, id DESC) AS rn
             FROM viewer_notices) ranked
           WHERE rn > ${NOTICE_KEEP_PER_PROFILE})
      RETURNING id`),
  );
  return { deleted: gone.length };
}
