/** Candidate poster frames score 0 to 100. Below this a frame is too dark, too flat or too blurry to be a good poster (M36-S01). */
export const LOW_FRAME_SCORE = 35;

/** True when there is at least one scored frame and every scored frame is low, so the admin should upload their own picture. */
export function allFramesLow(scores: readonly (number | null)[]): boolean {
  const scored = scores.filter((score): score is number => score !== null);
  return scored.length > 0 && scored.every((score) => score < LOW_FRAME_SCORE);
}
