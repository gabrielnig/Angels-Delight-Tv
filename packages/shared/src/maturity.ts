import { MATURITY_DEFAULT_LABELS, MATURITY_RANKS, type MaturityRank } from './enums';

/** The highest rank. An unrated title counts as this one, so every filter fails closed. */
export const MATURITY_MAX_RANK: MaturityRank = 4;

/** Rounds to an integer from 0 to 4. Anything that is not a number gives `fallback`. */
export function clampMaturityRank(value: unknown, fallback: MaturityRank = MATURITY_MAX_RANK): MaturityRank {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.min(4, Math.max(0, Math.trunc(value))) as MaturityRank;
}

/** The label for a rank. Each slot falls back to the default when the configured one is missing or empty. */
export function maturityLabel(rank: number, labels?: readonly string[] | null): string {
  const slot = clampMaturityRank(rank);
  const configured = labels?.[slot]?.trim();
  return configured ? configured : MATURITY_DEFAULT_LABELS[slot]!;
}

const DASHES = /[\u2012-\u2015]/;

/**
 * Parses the `maturity.labels` setting: five comma separated labels of 1 to 4 characters, all different, with no
 * dashes. Returns null when the value is not usable, so callers keep the defaults.
 */
export function parseMaturityLabels(raw: string): string[] | null {
  const parts = raw.split(',').map((part) => part.trim());
  if (parts.length !== MATURITY_RANKS.length) return null;
  if (parts.some((p) => p.length < 1 || p.length > 4 || DASHES.test(p))) return null;
  if (new Set(parts.map((p) => p.toLowerCase())).size !== parts.length) return null;
  return parts;
}
