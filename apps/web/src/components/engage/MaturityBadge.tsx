'use client';

import { useMaturityLabel } from '../../lib/maturity-context';

/** The rating of a title in the meta line, such as 12, spoken as Rated 12. Nothing for an unrated title (M44-S13). */
export function MaturityBadge({ rank }: { rank: number | null | undefined }) {
  const label = useMaturityLabel(rank ?? 0);
  if (rank === null || rank === undefined) return null;
  return (
    <span className="tv-rated" role="img" aria-label={`Rated ${label}`}>
      <span aria-hidden="true">{label}</span>
    </span>
  );
}
