/** Canonical and hreflang helpers. Pure, so they are cheap to test and safe to reuse in any page. */

const DROPPED = /^(utm_.*|fbclid|gclid|ref|sort|order|page_size)$/i;

/** One address per page: tracking and sort params are removed, kept params are sorted. */
export function canonicalPath(path: string, query: Record<string, string | undefined> = {}): string {
  const kept = Object.entries(query)
    .filter(([key, value]) => value !== undefined && value !== '' && !DROPPED.test(key))
    .sort(([a], [b]) => a.localeCompare(b));
  if (kept.length === 0) return path;
  const qs = kept.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v as string)}`).join('&');
  return `${path}?${qs}`;
}

/**
 * Language alternates, only when more than one locale is enabled. The first locale is the
 * default. The locale prefix scheme is a parameter so the L7 routing choice stays in one place.
 */
export function hreflangAlternates(
  path: string,
  locales: readonly string[],
  origin: string,
  prefix: (locale: string) => string = (l) => `/${l}`,
): Record<string, string> | undefined {
  if (locales.length < 2) return undefined;
  const out: Record<string, string> = {};
  for (const locale of locales) out[locale] = `${origin}${prefix(locale)}${path}`;
  out['x-default'] = out[locales[0] as string] as string;
  return out;
}

/** Search results and pages after the first stay out of the index but pass links on. */
export function listingRobots(input: { kind: 'search' } | { kind: 'list'; page: number }): {
  index: boolean;
  follow: boolean;
} {
  if (input.kind === 'search') return { index: false, follow: true };
  return { index: input.page <= 1, follow: true };
}
