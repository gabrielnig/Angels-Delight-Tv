import { isBot, lagosDay, type RateLimiter, type SponsorTrack } from '@ad/analytics';
import { clientIp, truncateIp, type TrustedProxyMode } from '@ad/security';
import { isSponsorSlot, type SponsorSlot } from '@ad/shared';
import { isGeneralAudience, isSafeDestination } from '@ad/sponsors';
import type { ViewerContext } from '../../lib/analytics/handler';

export interface ClickTarget {
  destinationUrl: string;
  /** Slots the creative is placed in. */
  slots: SponsorSlot[];
}

export interface SponsorClickDeps {
  /** Reads the creative from the database. Returns null unless its sponsor is live (row level security). */
  lookup(creativeId: string): Promise<ClickTarget | null>;
  track(entry: SponsorTrack): Promise<boolean>;
  limiter: RateLimiter;
  secret: Uint8Array;
  trustedProxyMode: TrustedProxyMode;
  resolveViewer(request: Request): Promise<ViewerContext>;
  isAdminPreview(request: Request): Promise<boolean>;
  warn(message: string, fields?: Record<string, unknown>): void;
  now?: () => Date;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const CLICK_LIMIT = { name: 'sponsor-click-ip', capacity: 30, refillPerSecond: 0.5 };

const headers = (extra: Record<string, string> = {}) => ({
  'Referrer-Policy': 'no-referrer',
  'Cache-Control': 'no-store',
  ...extra,
});
const notFound = () => new Response(null, { status: 404, headers: headers() });

/**
 * GET /s/{id} (M48-S16). The destination comes only from the database row, never from the request. Kids get a
 * 404 before anything is read or written, and an unknown audience counts as kids.
 */
export function createSponsorClickHandler(deps: SponsorClickDeps) {
  return async (request: Request, creativeId: string): Promise<Response> => {
    if (!UUID.test(creativeId)) return notFound();

    let viewer: ViewerContext;
    try {
      viewer = await deps.resolveViewer(request);
    } catch {
      return notFound();
    }
    if (!isGeneralAudience(viewer.audience)) return notFound();

    const ip = clientIp(request.headers, deps.trustedProxyMode);
    const verdict = await deps.limiter
      .consume(CLICK_LIMIT, (ip ? truncateIp(ip) : null) ?? 'unknown')
      .catch(() => ({ allowed: false, retryAfterSeconds: 30 }));
    if (!verdict.allowed) {
      return new Response(null, {
        status: 429,
        headers: headers({ 'Retry-After': String(verdict.retryAfterSeconds || 30) }),
      });
    }

    const target = await deps.lookup(creativeId).catch(() => null);
    if (!target || !isSafeDestination(target.destinationUrl)) return notFound();

    const hint = new URL(request.url).searchParams.get('p');
    const slot =
      hint && isSponsorSlot(hint) && target.slots.includes(hint) ? hint : target.slots[0];
    const count =
      slot !== undefined && !isBot(request.headers.get('user-agent')) && !(await deps.isAdminPreview(request).catch(() => true));
    if (count && slot) {
      try {
        await deps.track({
          day: lagosDay((deps.now ?? (() => new Date()))()),
          creativeId,
          slot,
          viewerHash: null,
          kind: 'clk',
        });
      } catch {
        deps.warn('sponsor click was not recorded', { creativeId });
      }
    }
    return new Response(null, { status: 302, headers: headers({ Location: target.destinationUrl }) });
  };
}

