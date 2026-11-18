export const POSTER_MAX_BYTES = 5 * 1024 * 1024;
export const POSTER_MIN_WIDTH = 1280;
export const POSTER_MIN_HEIGHT = 720;

export function validatePosterFile(file: {
  type: string;
  size: number;
  width: number;
  height: number;
}): string | null {
  if (!['image/jpeg', 'image/png'].includes(file.type)) return 'Use a JPG or PNG image.';
  if (file.size > POSTER_MAX_BYTES) return 'That image is over 5 MB. Choose a smaller one.';
  if (file.width < POSTER_MIN_WIDTH || file.height < POSTER_MIN_HEIGHT) {
    return `That image is ${file.width} by ${file.height}. Use at least ${POSTER_MIN_WIDTH} by ${POSTER_MIN_HEIGHT}.`;
  }
  return null;
}

export interface Focus {
  x: number;
  y: number;
}

export function clampFocus(focus: Focus): Focus {
  const clamp = (n: number) => Math.min(100, Math.max(0, Math.round(n)));
  return { x: clamp(focus.x), y: clamp(focus.y) };
}

export function focusFromPoint(
  rect: { left: number; top: number; width: number; height: number },
  clientX: number,
  clientY: number,
): Focus {
  return clampFocus({
    x: ((clientX - rect.left) / rect.width) * 100,
    y: ((clientY - rect.top) / rect.height) * 100,
  });
}

/** Same crop maths for every preview, so what the editor sees is what each place will show. */
export function previewStyle(focus: Focus, zoomPercent: number) {
  const origin = `${focus.x}% ${focus.y}%`;
  return {
    objectPosition: origin,
    transform: `scale(${zoomPercent / 100})`,
    transformOrigin: origin,
  };
}

/** Shape of the generated poster. Matches the `poster` preset in @ad/video, which cuts every poster at 16 by 9. */
const POSTER_RATIO = 16 / 9;
const clampUnit = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/**
 * Where the preview picture sits inside its frame so that it shows what the worker makes (M36-S03). The worker cuts
 * a 16 by 9 frame out of the real picture, 1 over zoom of its largest such frame, centred on the focus and held
 * inside the edges (cropRect in @ad/video). A frame of another shape then shows a band of that cut, kept around the
 * focus. `sourceRatio` is the width over height of the picture being previewed, 16 by 9 when it is not known.
 */
export function cropPreviewStyle(
  focus: Focus,
  zoomPercent: number,
  frameRatio: number,
  sourceRatio: number = POSTER_RATIO,
) {
  const zoom = clampUnit(zoomPercent, 100, 200) / 100;
  const fx = clampUnit(focus.x, 0, 100) / 100;
  const fy = clampUnit(focus.y, 0, 100) / 100;
  const wide = sourceRatio >= POSTER_RATIO;
  const cut = {
    w: (wide ? POSTER_RATIO / sourceRatio : 1) / zoom,
    h: (wide ? 1 : sourceRatio / POSTER_RATIO) / zoom,
    left: 0,
    top: 0,
  };
  cut.left = clampUnit(fx - cut.w / 2, 0, 1 - cut.w);
  cut.top = clampUnit(fy - cut.h / 2, 0, 1 - cut.h);
  const region = { ...cut };
  if (frameRatio > POSTER_RATIO) {
    region.h = cut.h * (POSTER_RATIO / frameRatio);
    region.top = cut.top + (cut.h - region.h) * clampUnit((fy - cut.top) / cut.h, 0, 1);
  } else if (frameRatio < POSTER_RATIO) {
    region.w = cut.w * (frameRatio / POSTER_RATIO);
    region.left = cut.left + (cut.w - region.w) * clampUnit((fx - cut.left) / cut.w, 0, 1);
  }
  const pct = (n: number) => `${Math.round(n * 10_000) / 100}%`;
  return {
    position: 'absolute' as const,
    maxWidth: 'none',
    width: pct(1 / region.w),
    height: pct(1 / region.h),
    left: pct(-region.left / region.w),
    top: pct(-region.top / region.h),
  };
}

/** Six frame times in seconds, evenly spread and away from the first and last second. */
export function candidateFrames(durationSeconds: number): number[] {
  const span = Math.max(6, durationSeconds - 2);
  return Array.from({ length: 6 }, (_, index) => Math.round(1 + (span * (index + 0.5)) / 6));
}

export interface PosterChoice {
  posterId: string;
  focus: Focus;
  zoom: number;
  alt: string;
}

export function validatePosterChoice(choice: PosterChoice): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!choice.posterId) errors.posterId = 'Pick a frame or upload your own image.';
  if (!choice.alt.trim()) errors.alt = 'Describe the poster for people who cannot see it.';
  else if (choice.alt.length > 200) errors.alt = 'Keep the description under 200 characters.';
  if (choice.zoom < 100 || choice.zoom > 200)
    errors.zoom = 'Zoom must be between 100 and 200 percent.';
  return errors;
}
