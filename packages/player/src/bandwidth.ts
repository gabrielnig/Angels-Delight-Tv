/** Last measured bandwidth on this device, so the first rung of the next session is not too high (M08-S18 edge). */

export interface BandwidthStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const KEY = 'ad.bandwidth';
const MIN_BPS = 200_000;
const MAX_BPS = 8_000_000;

export function clampBandwidth(bps: number): number | null {
  if (!Number.isFinite(bps) || bps <= 0) return null;
  return Math.min(MAX_BPS, Math.max(MIN_BPS, Math.round(bps)));
}

export function readBandwidthSeed(storage: BandwidthStorage | null): number | null {
  try {
    const raw = storage?.getItem(KEY);
    return raw ? clampBandwidth(Number(raw)) : null;
  } catch {
    return null;
  }
}

export function saveBandwidth(storage: BandwidthStorage | null, bps: number): void {
  const value = clampBandwidth(bps);
  if (value === null) return;
  try {
    storage?.setItem(KEY, String(value));
  } catch {
    // Storage is best effort.
  }
}
