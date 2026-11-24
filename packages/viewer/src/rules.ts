/**
 * Viewer rules with the defaults from docs/DECISIONS.md D-004 and the user stories. Site configuration (M29) can
 * override any of them through ViewerContext.rules, nothing here is a client decision hardcoded.
 */
export interface ViewerRules {
  /** Playback resumes this far before the saved position (M09-S04). */
  resumeRewindMs: number;
  /** Positions below this are not saved as progress (M09-S02). */
  minProgressMs: number;
  /** A title counts as finished at this fraction of its duration (M09-S03). */
  finishedFraction: number;
  /** Or when this little time remains, whichever comes first. */
  finishedRemainingMs: number;
  /** Clock skew tolerated between a client timestamp and the server (M09-S06). */
  maxClockSkewMs: number;
  /** A backwards write larger than this, without a seek flag, right after another write is ignored (M09-S06). */
  backwardJumpMs: number;
  backwardGuardWindowMs: number;
  /** Continue Watching row size and age limit (M09-S01, M09-S08). Null age means no expiry. */
  continueWatchingLimit: number;
  continueWatchingMaxAgeDays: number | null;
  /** My List capacity per profile (M10-S01). */
  maxMyListItems: number;
  /** Default pages and the home row batch size (M05-S04). */
  homeRowsPerPage: number;
  personalRowItems: number;
  /** Newest titles shown as the hero when none are chosen (M41-S03). */
  heroFallbackCount: number;
  /** Trending needs this many titles with views, otherwise the row is hidden (M41-S05). */
  popularMinItems: number;
  trendingWindowDays: number;
  /** Popular looks back this many days, counts titles with at least this many views, and shows at least this many titles. */
  popularWindowDays: number;
  popularMinViews: number;
  popularMinTitles: number;
  /** An automatic category row needs this many live titles, and at most this many rows are made (M41-S05). */
  autoCategoryMinItems: number;
  autoCategoryMax: number;
  /** The All series row is hidden under this many series. */
  allSeriesMinItems: number;
}

export const DEFAULT_RULES: ViewerRules = {
  resumeRewindMs: 3000,
  minProgressMs: 5000,
  finishedFraction: 0.95,
  finishedRemainingMs: 10_000,
  maxClockSkewMs: 5 * 60_000,
  backwardJumpMs: 30_000,
  backwardGuardWindowMs: 5000,
  continueWatchingLimit: 20,
  continueWatchingMaxAgeDays: 60,
  maxMyListItems: 500,
  homeRowsPerPage: 3,
  personalRowItems: 20,
  heroFallbackCount: 5,
  popularMinItems: 4,
  trendingWindowDays: 7,
  popularWindowDays: 30,
  popularMinViews: 5,
  popularMinTitles: 3,
  autoCategoryMinItems: 4,
  autoCategoryMax: 6,
  allSeriesMinItems: 2,
};
