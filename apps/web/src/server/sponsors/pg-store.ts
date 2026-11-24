import { writeAudit } from '@ad/audit';
import { schema, withAccount, type Database } from '@ad/db';
import type {
  AuditEntry,
  CreativeRow,
  CreativeWithSlots,
  PrivateRow,
  SponsorAdminStore,
  SponsorRow,
} from '@ad/sponsors';
import type { Actor, SponsorSlot, SponsorStoredStatus } from '@ad/shared';
import { eq, inArray, sql } from 'drizzle-orm';

const { sponsors, sponsorPrivate, sponsorCreatives, sponsorPlacements } = schema;

const toSponsor = (r: typeof sponsors.$inferSelect): SponsorRow => ({
  id: r.id,
  name: r.name,
  status: r.status,
  startsAt: r.startsAt,
  endsAt: r.endsAt,
  createdBy: r.createdBy,
});

const toCreative = (r: typeof sponsorCreatives.$inferSelect): CreativeRow => ({
  id: r.id,
  sponsorId: r.sponsorId,
  headline: r.headline,
  body: r.body,
  ctaLabel: r.ctaLabel,
  destinationUrl: r.destinationUrl,
  imageSquareAssetId: r.imageSquareAssetId,
  imageWideAssetId: r.imageWideAssetId,
  altText: r.altText,
  weight: r.weight,
  active: r.active,
});

type Tx = Database;

/** Postgres store for the sponsors admin. Every call runs as the acting staff member, so row level security applies. */
export function createPgSponsorStore(db: Database, actor: Actor): SponsorAdminStore {
  const run = <T>(fn: (tx: Tx) => Promise<T>): Promise<T> =>
    withAccount(db as never, actor, ((tx: unknown) => fn(tx as Tx)) as never) as Promise<T>;

  async function slotsFor(tx: Tx, creativeIds: string[]): Promise<Map<string, SponsorSlot[]>> {
    const map = new Map<string, SponsorSlot[]>();
    if (creativeIds.length === 0) return map;
    const rows = await tx
      .select()
      .from(sponsorPlacements)
      .where(inArray(sponsorPlacements.creativeId, creativeIds));
    for (const r of rows) map.set(r.creativeId, [...(map.get(r.creativeId) ?? []), r.slot]);
    return map;
  }

  const privValues = (priv: PrivateRow) => ({
    contactNameEnc: priv.contactNameSealed ? Buffer.from(priv.contactNameSealed, 'utf8') : null,
    contactEmailEnc: priv.contactEmailSealed ? Buffer.from(priv.contactEmailSealed, 'utf8') : null,
    notes: priv.notes,
  });

  return {
    async insertSponsor(row, priv) {
      await run(async (tx) => {
        await tx.insert(sponsors).values(row);
        await tx.insert(sponsorPrivate).values({ sponsorId: row.id, ...privValues(priv) });
      });
    },
    async updateSponsor(id, patch, priv) {
      return run(async (tx) => {
        const updated = await tx
          .update(sponsors)
          .set(patch)
          .where(eq(sponsors.id, id))
          .returning({ id: sponsors.id });
        if (updated.length === 0) return false;
        await tx
          .insert(sponsorPrivate)
          .values({ sponsorId: id, ...privValues(priv) })
          .onConflictDoUpdate({ target: sponsorPrivate.sponsorId, set: privValues(priv) });
        return true;
      });
    },
    async getSponsor(id) {
      return run(async (tx) => {
        const [s] = await tx.select().from(sponsors).where(eq(sponsors.id, id));
        if (!s) return null;
        const [p] = await tx.select().from(sponsorPrivate).where(eq(sponsorPrivate.sponsorId, id));
        const cs = await tx.select().from(sponsorCreatives).where(eq(sponsorCreatives.sponsorId, id));
        const slots = await slotsFor(tx, cs.map((c) => c.id));
        return {
          sponsor: toSponsor(s),
          priv: {
            contactNameSealed: p?.contactNameEnc ? p.contactNameEnc.toString('utf8') : null,
            contactEmailSealed: p?.contactEmailEnc ? p.contactEmailEnc.toString('utf8') : null,
            notes: p?.notes ?? null,
          },
          creatives: cs.map(
            (c): CreativeWithSlots => ({ ...toCreative(c), slots: slots.get(c.id) ?? [] }),
          ),
        };
      });
    },
    async listSponsors() {
      return run(async (tx) => {
        const rows = await tx.select().from(sponsors).orderBy(sponsors.createdAt);
        const counts = await tx
          .select({ sponsorId: sponsorCreatives.sponsorId, n: sql<number>`count(*)::int` })
          .from(sponsorCreatives)
          .groupBy(sponsorCreatives.sponsorId);
        const byId = new Map(counts.map((c) => [c.sponsorId, c.n]));
        return rows.map((r) => ({ sponsor: toSponsor(r), creativeCount: byId.get(r.id) ?? 0 }));
      });
    },
    async setStatus(id, status: SponsorStoredStatus) {
      return run(async (tx) => {
        const r = await tx
          .update(sponsors)
          .set({ status })
          .where(eq(sponsors.id, id))
          .returning({ id: sponsors.id });
        return r.length > 0;
      });
    },
    async hasStats(id) {
      return run(async (tx) => {
        const r = await tx.execute(
          sql`SELECT 1 FROM sponsor_daily_stats WHERE sponsor_id = ${id}::uuid LIMIT 1`,
        );
        return ((r as unknown as { rows?: unknown[] }).rows ?? []).length > 0;
      });
    },
    async deleteSponsor(id) {
      await run((tx) => tx.delete(sponsors).where(eq(sponsors.id, id)));
    },
    async insertCreative(row, slots) {
      await run(async (tx) => {
        await tx.insert(sponsorCreatives).values(row);
        if (slots.length)
          await tx.insert(sponsorPlacements).values(slots.map((slot) => ({ creativeId: row.id, slot })));
      });
    },
    async updateCreative(id, patch, slots) {
      return run(async (tx) => {
        const r = await tx
          .update(sponsorCreatives)
          .set(patch)
          .where(eq(sponsorCreatives.id, id))
          .returning({ id: sponsorCreatives.id });
        if (r.length === 0) return false;
        await tx.delete(sponsorPlacements).where(eq(sponsorPlacements.creativeId, id));
        if (slots.length)
          await tx.insert(sponsorPlacements).values(slots.map((slot) => ({ creativeId: id, slot })));
        return true;
      });
    },
    async getCreative(id) {
      return run(async (tx) => {
        const [c] = await tx.select().from(sponsorCreatives).where(eq(sponsorCreatives.id, id));
        if (!c) return null;
        const slots = await slotsFor(tx, [id]);
        return { ...toCreative(c), slots: slots.get(id) ?? [] };
      });
    },
    async deleteCreative(id) {
      await run((tx) => tx.delete(sponsorCreatives).where(eq(sponsorCreatives.id, id)));
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
