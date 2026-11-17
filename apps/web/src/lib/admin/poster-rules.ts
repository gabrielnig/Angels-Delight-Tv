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
