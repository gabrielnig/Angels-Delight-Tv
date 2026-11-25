const segments = (p: string): string[] => (p.split(/[?#]/)[0] ?? '').split('/').filter(Boolean);

/** True when a pathname fits a route pattern such as /admin/videos/[id]. A trailing slash, query and hash are ignored. */
export function matchScreen(pattern: string, pathname: string): boolean {
  const a = segments(pattern);
  const b = segments(pathname);
  if (a.length !== b.length) return false;
  return a.every((seg, i) => (seg.startsWith('[') && seg.endsWith(']') ? true : seg === b[i]));
}

/** The most specific pattern for a pathname: the one with the most static segments. */
export function bestScreenMatch(patterns: readonly string[], pathname: string): string | null {
  let best: string | null = null;
  let score = -1;
  for (const pattern of patterns) {
    if (!matchScreen(pattern, pathname)) continue;
    const s = segments(pattern).filter((x) => !x.startsWith('[')).length;
    if (s > score) {
      best = pattern;
      score = s;
    }
  }
  return best;
}
