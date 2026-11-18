import sharp from 'sharp';

export interface FrameScore {
  /** 0 to 100. Below `LOW_FRAME_SCORE` (from @ad/shared) a frame makes a poor poster. */
  score: number;
  /** Mean brightness, 0 to 255. */
  brightness: number;
  /** Spread of the edge response, 0 to 255. Low means soft. */
  sharpness: number;
  black: boolean;
  blurry: boolean;
}

const WIDTH = 160;
const HEIGHT = 90;
const clamp = (n: number, lo = 0, hi = 100) => Math.min(hi, Math.max(lo, n));
const LAPLACIAN = { width: 3, height: 3, kernel: [0, 1, 0, 1, -4, 1, 0, 1, 0], scale: 1, offset: 128 };

/** Dark and washed out frames both fail: full marks between 50 and 215, nothing at 10 or below and 245 or above. */
function lightScore(mean: number): number {
  if (mean <= 50) return clamp(((mean - 10) / 40) * 100);
  if (mean >= 215) return clamp(((245 - mean) / 30) * 100);
  return 100;
}

/**
 * A simple score for a poster frame, from a small greyscale copy: how well lit it is, how much contrast it has and how
 * sharp its edges are (the spread of a Laplacian filter). A black or blank frame scores 0. Good enough to rank six
 * frames from one video, not an aesthetic judgement.
 */
export async function scoreFrame(bytes: Uint8Array): Promise<FrameScore> {
  const grey = sharp(bytes).resize(WIDTH, HEIGHT, { fit: 'fill' }).greyscale().removeAlpha();
  const plain = await grey.clone().stats();
  const edges = await grey.clone().convolve(LAPLACIAN).stats();
  const brightness = plain.channels[0]!.mean;
  const contrast = plain.channels[0]!.stdev;
  const sharpness = edges.channels[0]!.stdev;

  const light = lightScore(brightness);
  const contrastScore = clamp((contrast / 30) * 100);
  const sharpScore = clamp((sharpness / 25) * 100);
  const score = Math.round(Math.min(light, (contrastScore + sharpScore) / 2));
  return {
    score,
    brightness,
    sharpness,
    black: brightness < 16,
    blurry: sharpness < 10,
  };
}
