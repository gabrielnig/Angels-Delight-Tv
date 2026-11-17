import 'server-only';
import { adminNavCounts, listAdminVideos } from '@ad/catalog';
import { sql } from 'drizzle-orm';
import { can } from '@/lib/admin/can';
import { adminRuntime } from '@/server/admin/runtime';
import type { DashboardService } from '../services';
import { buildDashboard } from '../dashboard';
import type { AdminStore } from '../store';
import { catalogActor, need, toRecords } from './shared';
import { readStorageCap, readStorageTotals } from './system';

const DAY = 86_400_000;

/** Views for the 14 days before today, oldest first, from the nightly rollup. Missing days count as zero. */
async function dailyViews(now: number): Promise<number[]> {
  const result = await adminRuntime().db().execute(sql`
    SELECT day::text AS day, views FROM site_daily_stats WHERE day >= (now() AT TIME ZONE 'Africa/Lagos')::date - 14`);
  const byDay = new Map(
    result.rows.map((r) => [
      String((r as { day: string }).day),
      Number((r as { views: number }).views),
    ]),
  );
  const lagos = (ms: number) => new Date(ms + 3_600_000).toISOString().slice(0, 10);
  return Array.from({ length: 14 }, (_, i) => byDay.get(lagos(now - (14 - i) * DAY)) ?? 0);
}

export const realDashboardService: DashboardService = {
  async get(actor, options) {
    need(actor, 'admin.access');
    const ctx = await adminRuntime().ctx();
    const now = Date.now();
    const videos = await toRecords(actor, await listAdminVideos(ctx, catalogActor(actor)));
    const store = {
      videos,
      settings: { requireApprovedCaptions: ctx.requireApprovedCaptions ?? true },
      dailyViews: can(actor.role, 'analytics.view') ? await dailyViews(now) : [],
    } as unknown as AdminStore;
    const data = buildDashboard(actor, store, { now, failTiles: options?.failTiles });
    if (data.storage.state === 'ready') {
      const [t, cap] = await Promise.all([readStorageTotals(), readStorageCap()]);
      const used =
        t.originalBytes + t.streamingBytes + t.posterBytes + t.captionBytes + t.otherBytes;
      const monthsLeft =
        t.growth30Bytes > 0
          ? Math.max(0, Math.min(99, Math.floor((cap - used) / t.growth30Bytes)))
          : 99;
      data.storage = {
        state: 'ready',
        value: {
          usedBytes: used,
          capBytes: cap,
          originalsBytes: t.originalBytes,
          streamingBytes: t.streamingBytes,
          monthsLeft,
        },
      };
    }
    return data;
  },
  async navCounts(actor) {
    if (!can(actor.role, 'admin.access')) return { encoding: 0, captions: 0 };
    return adminNavCounts(await adminRuntime().ctx(), catalogActor(actor));
  },
};
