import 'server-only';
import { cookies, headers } from 'next/headers';
import { sql } from 'drizzle-orm';
import { isSponsorSlot, type SponsorSlot, type SponsorStoredStatus } from '@ad/shared';
import {
  capCookieName,
  lagosDayNumber,
  parseCapCookie,
  type SelectedSponsor,
  type SponsorCandidate,
  type SponsorSettings,
} from '@ad/sponsors';
import { themeRuntime } from '../../lib/data/admin/theme-runtime';
import type { ViewerContext } from '../../lib/data/types';
import { getServices } from '../../lib/runtime/services';
import { loadSponsor, type SurfaceDeps } from './surface';

type Variant = { width: number; key: string; format?: string; full?: boolean };
interface Row {
  sponsor_id: string;
  name: string;
  status: SponsorStoredStatus;
  starts_at: Date | string | null;
  ends_at: Date | string | null;
  creative_id: string;
  headline: string;
  body: string | null;
  cta_label: string;
  destination_url: string;
  alt_text: string | null;
  weight: number;
  active: boolean;
  square: Variant[] | null;
  wide: Variant[] | null;
}

const rowsOf = <T>(result: unknown): T[] => {
  const r = (result as { rows?: unknown } | null)?.rows;
  return Array.isArray(r) ? (r as T[]) : Array.isArray(result) ? (result as T[]) : [];
};
const asDate = (v: Date | string | null) =>
  v === null ? null : v instanceof Date ? v : new Date(v);

/** The smallest webp variant at or above the wanted width, else the largest. Admin-only full previews are skipped. */
export function pickVariantUrl(
  variants: Variant[] | null,
  wanted: number,
  origin: string,
): string | null {
  const usable = (variants ?? []).filter(
    (v) => !v.full && (v.format === undefined || v.format === 'webp'),
  );
  if (usable.length === 0) return null;
  const sorted = [...usable].sort((a, b) => a.width - b.width);
  const pick = sorted.find((v) => v.width >= wanted) ?? sorted[sorted.length - 1]!;
  return `${origin.replace(/\/+$/, '')}/${pick.key}`;
}

async function readSettings(): Promise<SponsorSettings> {
  const s = (await themeRuntime()).settings;
  const [
    enabled,
    home,
    title,
    after,
    before,
    afterRow,
    beforeSeconds,
    fHome,
    fTitle,
    fAfter,
    fBefore,
    label,
    newTab,
    rotation,
  ] = await Promise.all([
    s.get('sponsors.enabled'),
    s.get('sponsors.placement.home_banner.enabled'),
    s.get('sponsors.placement.title_card.enabled'),
    s.get('sponsors.placement.player_after.enabled'),
    s.get('sponsors.placement.player_before.enabled'),
    s.get('sponsors.home_banner.after_row'),
    s.get('sponsors.player_before.seconds'),
    s.get('sponsors.freq.home_banner_per_day'),
    s.get('sponsors.freq.title_card_per_day'),
    s.get('sponsors.freq.player_after_per_session'),
    s.get('sponsors.freq.player_before_per_session'),
    s.get('sponsors.label'),
    s.get('sponsors.link_new_tab'),
    s.get('sponsors.rotation'),
  ]);
  return {
    enabled,
    placements: {
      home_banner: home,
      title_card: title,
      player_after: after,
      player_before: before,
    },
    caps: { home_banner: fHome, title_card: fTitle, player_after: fAfter, player_before: fBefore },
    rotation,
    label,
    linkNewTab: newTab,
    homeAfterRow: afterRow,
    beforeSeconds,
  };
}

/** Live creatives for one slot. Runs without an actor, so row level security shows live sponsors only. */
async function readCandidates(slot: SponsorSlot): Promise<SponsorCandidate[]> {
  const services = getServices();
  const origin = services.env.MEDIA_ORIGIN;
  const result = await services.db.execute(sql`
    SELECT s.id AS sponsor_id, s.name, s.status::text AS status, s.starts_at, s.ends_at,
           c.id AS creative_id, c.headline, c.body, c.cta_label, c.destination_url, c.alt_text, c.weight, c.active,
           sq.variants AS square, wd.variants AS wide
      FROM sponsor_placements p
      JOIN sponsor_creatives c ON c.id = p.creative_id
      JOIN sponsors s ON s.id = c.sponsor_id
      LEFT JOIN assets sq ON sq.id = c.image_square_asset_id AND sq.status = 'ready'
      LEFT JOIN assets wd ON wd.id = c.image_wide_asset_id AND wd.status = 'ready'
     WHERE p.slot = ${slot}::sponsor_slot
     ORDER BY c.id
     LIMIT 50`);
  return rowsOf<Row>(result).map((r) => ({
    sponsorId: r.sponsor_id,
    sponsorName: r.name,
    status: r.status,
    startsAt: asDate(r.starts_at),
    endsAt: asDate(r.ends_at),
    creativeId: r.creative_id,
    headline: r.headline,
    body: r.body,
    ctaLabel: r.cta_label,
    destinationUrl: r.destination_url,
    imageSquareUrl: pickVariantUrl(r.square, 208, origin),
    imageWideUrl: pickVariantUrl(r.wide, 900, origin),
    altText: r.alt_text,
    weight: r.weight,
    active: r.active,
    slots: [slot].filter(isSponsorSlot),
  }));
}

const deps: SurfaceDeps = {
  settings: readSettings,
  candidates: (slot) => readCandidates(slot),
  now: () => new Date(),
};

/**
 * The sponsor for a slot on a server rendered page, or null. Kids and kids mode get null before any read
 * (the audience is checked first), and so does everything that goes wrong.
 */
export async function sponsorFor(
  slot: SponsorSlot,
  ctx: Pick<ViewerContext, 'audience' | 'guest'>,
  options: { saveData?: boolean; resumeSeconds?: number } = {},
): Promise<SelectedSponsor | null> {
  const audience = ctx.audience === 'adult' ? 'general' : ctx.audience;
  if (audience !== 'general') return null;
  try {
    const jar = await cookies();
    const caps = parseCapCookie(jar.get(capCookieName(slot))?.value, lagosDayNumber(new Date()));
    const siteGuest = (await themeRuntime()).settings.get('features.guest_audience');
    return await loadSponsor(deps, {
      slot,
      audience,
      viewer: ctx.guest ? 'guest' : 'account',
      siteGuestAudience: (await siteGuest) === 'kids' ? 'kids' : 'general',
      caps,
      saveData:
        options.saveData === true || (await headers()).get('save-data')?.toLowerCase() === 'on',
      resumeSeconds: options.resumeSeconds ?? 0,
    });
  } catch {
    return null;
  }
}

export async function homeBannerRow(): Promise<number> {
  try {
    return (await readSettings()).homeAfterRow;
  } catch {
    return 3;
  }
}

export async function sponsorBeforeSeconds(): Promise<number> {
  try {
    return (await readSettings()).beforeSeconds;
  } catch {
    return 5;
  }
}
