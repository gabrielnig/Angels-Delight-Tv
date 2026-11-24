import { writeAudit } from '@ad/audit';
import { withAccount, type Database } from '@ad/db';
import type { AuditEntry, ReportStore, StatRow } from '@ad/sponsors';
import type { Actor, SponsorSlot } from '@ad/shared';
import { sql } from 'drizzle-orm';

type Tx = Database;

const rowsOf = <T>(result: unknown): T[] => {
  const r = (result as { rows?: unknown } | null)?.rows;
  return Array.isArray(r) ? (r as T[]) : Array.isArray(result) ? (result as T[]) : [];
};

/** Reads sponsor numbers as one staff member, so row level security decides what they may see. */
export function createPgReportStore(db: Database, actor: Actor): ReportStore {
  const run = <T>(fn: (tx: Tx) => Promise<T>): Promise<T> =>
    withAccount(db as never, actor, ((tx: unknown) => fn(tx as Tx)) as never) as Promise<T>;
  return {
    async sponsor(id) {
      const found = rowsOf<{ id: string; name: string }>(
        await run((tx) => tx.execute(sql`SELECT id, name FROM sponsors WHERE id = ${id}::uuid`)),
      );
      return found[0] ?? null;
    },
    async creatives(sponsorId) {
      return rowsOf<{ id: string; headline: string }>(
        await run((tx) => tx.execute(sql`SELECT id, headline FROM sponsor_creatives WHERE sponsor_id = ${sponsorId}::uuid`)),
      );
    },
    async stats(sponsorId, fromDay, toDay): Promise<StatRow[]> {
      const found = rowsOf<{
        day: string | Date;
        creative_id: string;
        slot: SponsorSlot;
        impressions: number;
        clicks: number;
        reach: number;
      }>(
        await run((tx) =>
          tx.execute(sql`
            SELECT to_char(day, 'YYYY-MM-DD') AS day, creative_id, slot::text AS slot, impressions, clicks, reach
              FROM sponsor_daily_stats
             WHERE sponsor_id = ${sponsorId}::uuid AND day BETWEEN ${fromDay}::date AND ${toDay}::date
             ORDER BY day, creative_id, slot`),
        ),
      );
      return found.map((r) => ({
        day: String(r.day),
        creativeId: r.creative_id,
        slot: r.slot,
        impressions: Number(r.impressions),
        clicks: Number(r.clicks),
        reach: Number(r.reach),
      }));
    },
    async audit(entry: AuditEntry) {
      await run((tx) =>
        writeAudit(tx, {
          action: entry.action,
          outcome: 'success',
          actorAccountId: entry.actorAccountId,
          actorRole: entry.actorRole,
          targetType: entry.targetType,
          targetId: entry.targetId,
          extra: entry.metadata ?? {},
        }),
      );
    },
  };
}
