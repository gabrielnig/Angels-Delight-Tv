import 'server-only';
import { createPgEventStore } from '@ad/analytics';
import { RateLimiter } from '@ad/security';
import { isSponsorSlot, type SponsorSlot } from '@ad/shared';
import { sql } from 'drizzle-orm';
import { resolveViewer } from '../../lib/data/analytics-viewer';
import { getServices } from '../../lib/runtime/services';
import { installRealViewerResolver } from '../viewer/install-analytics';
import { realAuthEnabled } from '../auth/mode';
import { getSession } from '../auth/session';
import { staffPreview } from './preview';
import { createSponsorClickHandler, type ClickTarget } from './click';

const rows = <T>(result: unknown): T[] => {
  const r = (result as { rows?: unknown } | null)?.rows;
  return Array.isArray(r) ? (r as T[]) : Array.isArray(result) ? (result as T[]) : [];
};

/** Wires the click handler to the database. The lookup runs without an actor, so row level security shows live sponsors only. */
export function sponsorClickHandler() {
  installRealViewerResolver();
  const services = getServices();
  const store = createPgEventStore(services.db);
  return createSponsorClickHandler({
    lookup: async (creativeId): Promise<ClickTarget | null> => {
      const found = rows<{ destination_url: string; slot: string }>(
        await services.db.execute(sql`
          SELECT c.destination_url, p.slot::text AS slot
            FROM sponsor_creatives c
            JOIN sponsor_placements p ON p.creative_id = c.id
           WHERE c.id = ${creativeId}::uuid
           ORDER BY p.slot`),
      );
      const first = found[0];
      if (!first) return null;
      const slots = found.map((r) => r.slot).filter((s): s is SponsorSlot => isSponsorSlot(s));
      return { destinationUrl: first.destination_url, slots };
    },
    track: async (entry) => (store.trackSponsor ? store.trackSponsor(entry) : false),
    limiter: new RateLimiter(services.db),
    secret: services.analyticsSecret,
    trustedProxyMode: services.env.TRUSTED_PROXY_MODE,
    resolveViewer,
    // A signed in staff member is previewing the card: the click goes through and is not counted.
    isAdminPreview: () =>
      staffPreview(async () => (realAuthEnabled() ? (await getSession())?.role : null)),
    warn: (message, fields) => services.logger.warn(message, fields),
  });
}
