import {
  isGeneralAudience,
  selectSponsor,
  type CapMap,
  type SelectedSponsor,
  type SponsorCandidate,
  type SponsorSettings,
} from '@ad/sponsors';
import type { SponsorSlot } from '@ad/shared';

export interface SurfaceDeps {
  settings(): Promise<SponsorSettings>;
  candidates(slot: SponsorSlot, now: Date): Promise<SponsorCandidate[]>;
  now(): Date;
}

export interface SurfaceInput {
  slot: SponsorSlot;
  audience: unknown;
  viewer: 'guest' | 'account';
  siteGuestAudience: 'general' | 'kids';
  caps: CapMap;
  saveData: boolean;
  resumeSeconds: number;
}

/**
 * Picks the sponsor for one slot, or null. Fails closed: kids, an unknown audience, a switch that is off, a
 * guest on a kids site and any error all give null, and in the first four the database is never read.
 */
export async function loadSponsor(
  deps: SurfaceDeps,
  input: SurfaceInput,
): Promise<SelectedSponsor | null> {
  if (!isGeneralAudience(input.audience)) return null;
  if (input.viewer === 'guest' && input.siteGuestAudience !== 'general') return null;
  try {
    const settings = await deps.settings();
    if (!settings.enabled || !settings.placements[input.slot]) return null;
    const now = deps.now();
    const candidates = await deps.candidates(input.slot, now);
    return selectSponsor({ ...input, settings, candidates, now });
  } catch {
    return null;
  }
}
