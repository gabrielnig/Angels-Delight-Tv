/** The still shows first, the clip waits this long before it loads. */
export const HERO_PREVIEW_DELAY_MS = 1200;
/** Extra time past the clip's own length before the slide moves on without waiting any longer. */
export const HERO_CLIP_GRACE_MS = 2000;
/** Length assumed for a clip whose length was never recorded (made before D-353, all 6 seconds). */
export const HERO_LEGACY_CLIP_MS = 6000;

/**
 * How long a slide stays (D-351, D-366). Without a clip, or when the owner setting says the dwell decides, it is the
 * dwell time. When the slide waits for its clip it is the clip length plus the start delay and a grace, a ceiling
 * that the clip's own end normally beats, so the carousel never gets stuck on a clip that never finishes.
 * Undefined means rotation is off.
 */
export function slideDurationMs(input: {
  dwellMs: number | undefined;
  waitForClip: boolean;
  clipMs: number | undefined;
  hasClip: boolean;
}): number | undefined {
  if (!input.dwellMs) return undefined;
  if (!input.waitForClip || !input.hasClip) return input.dwellMs;
  return (input.clipMs ?? HERO_LEGACY_CLIP_MS) + HERO_PREVIEW_DELAY_MS + HERO_CLIP_GRACE_MS;
}
