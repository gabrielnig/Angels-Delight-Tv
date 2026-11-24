import type { SponsorSlot, SponsorStoredStatus } from '@ad/shared';
import { capCount, type CapMap } from './caps';
import { deriveSponsorStatus, lagosDayNumber } from './status';

export type SponsorLabelKey = 'sponsored' | 'sponsor_message' | 'in_partnership_with';

export interface SponsorSettings {
  enabled: boolean;
  placements: Record<SponsorSlot, boolean>;
  /** Day caps for home and title, visit caps for the player slots. */
  caps: Record<SponsorSlot, number>;
  rotation: 'even' | 'weighted';
  label: SponsorLabelKey;
  linkNewTab: boolean;
  homeAfterRow: number;
  beforeSeconds: number;
}

export interface SponsorCandidate {
  sponsorId: string;
  sponsorName: string;
  status: SponsorStoredStatus;
  startsAt: Date | null;
  endsAt: Date | null;
  creativeId: string;
  headline: string;
  body: string | null;
  ctaLabel: string;
  destinationUrl: string;
  imageSquareUrl: string | null;
  imageWideUrl: string | null;
  altText: string | null;
  weight: number;
  active: boolean;
  slots: SponsorSlot[];
}

export interface SelectInput {
  slot: SponsorSlot;
  /** Only the exact value `general` passes. Anything else is treated as kids (fail closed). */
  audience: unknown;
  viewer: 'guest' | 'account';
  siteGuestAudience: 'general' | 'kids';
  now: Date;
  settings: SponsorSettings;
  candidates: SponsorCandidate[];
  caps: CapMap;
  saveData: boolean;
  /** Seconds already watched. Above zero means resume, so no before card. */
  resumeSeconds: number;
}

/** What the page renders. The destination never leaves the server: the link is our own redirect. */
export interface SelectedSponsor {
  sponsorId: string;
  sponsorName: string;
  creativeId: string;
  slot: SponsorSlot;
  headline: string;
  body: string | null;
  ctaLabel: string;
  href: string;
  imageUrl: string | null;
  wideImageUrl: string | null;
  altText: string | null;
  textOnly: boolean;
  label: SponsorLabelKey;
  newTab: boolean;
}

/** The one audience test every sponsor and donation code path uses. Unknown means kids. */
export const isGeneralAudience = (audience: unknown): boolean => audience === 'general';

export function isSafeDestination(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.username === '' && url.password === '' && url.hostname !== '';
  } catch {
    return false;
  }
}

/** Picks at most one creative for a slot, or null. Never throws, never returns anything for kids. */
export function selectSponsor(input: SelectInput): SelectedSponsor | null {
  if (!isGeneralAudience(input.audience)) return null;
  if (input.viewer === 'guest' && input.siteGuestAudience !== 'general') return null;
  const { settings, slot, now } = input;
  if (!settings.enabled || !settings.placements[slot]) return null;
  if (slot === 'player_before' && (input.saveData || input.resumeSeconds > 0)) return null;

  const today = lagosDayNumber(now);
  const cap = settings.caps[slot];
  const eligible = input.candidates
    .filter((c) => c.active && c.slots.includes(slot))
    .filter((c) => deriveSponsorStatus(c, now) === 'live')
    .filter((c) => isSafeDestination(c.destinationUrl))
    .filter((c) => capCount(input.caps, c.creativeId, slot, today) < cap)
    .sort((a, b) => (a.creativeId < b.creativeId ? -1 : a.creativeId > b.creativeId ? 1 : 0));
  if (eligible.length === 0) return null;

  const chosen = settings.rotation === 'weighted' ? pickWeighted(eligible, today) : eligible[today % eligible.length];
  if (!chosen) return null;

  const hasImage = Boolean(chosen.imageSquareUrl || chosen.imageWideUrl);
  const textOnly = input.saveData || !hasImage;
  return {
    sponsorId: chosen.sponsorId,
    sponsorName: chosen.sponsorName,
    creativeId: chosen.creativeId,
    slot,
    headline: chosen.headline,
    body: chosen.body,
    ctaLabel: chosen.ctaLabel,
    href: `/s/${chosen.creativeId}`,
    imageUrl: textOnly ? null : chosen.imageSquareUrl,
    wideImageUrl: textOnly ? null : chosen.imageWideUrl,
    altText: textOnly ? null : chosen.altText,
    textOnly,
    label: settings.label,
    newTab: settings.linkNewTab,
  };
}

function pickWeighted(list: SponsorCandidate[], today: number): SponsorCandidate | undefined {
  const total = list.reduce((sum, c) => sum + Math.max(1, c.weight), 0);
  let point = today % total;
  for (const c of list) {
    point -= Math.max(1, c.weight);
    if (point < 0) return c;
  }
  return list[0];
}
