/** Rating counts for one title, from the ratings rollup. Dislikes are shown to staff as "Not for me". */
export interface RatingTotals {
  likes: number;
  loves: number;
  dislikes: number;
}

/** Under this many ratings a share is not shown (M44-S06). */
export const MIN_RATINGS_FOR_SHARE = 10;

export const totalRatings = (t: RatingTotals): number => t.likes + t.loves + t.dislikes;

/** Like plus Love as a whole percent of all ratings, or null when there are too few ratings to mean anything. */
export function positiveShare(t: RatingTotals): number | null {
  const total = totalRatings(t);
  if (total < MIN_RATINGS_FOR_SHARE) return null;
  return Math.round(((t.likes + t.loves) / total) * 100);
}
