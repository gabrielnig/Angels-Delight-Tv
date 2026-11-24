import { createHash } from 'node:crypto';
import { inputSafety } from './encode/ffmpeg';
import type { Container } from './magic';

/** Worker constants for the Home hero preview clip (M41-S11, plan 4.3). */
export const PREVIEW_CLIP_MS = 6000;
export const PREVIEW_WIDTH = 854;
export const PREVIEW_CRF = 27;
export const PREVIEW_RETRY_CRF = 31;
export const PREVIEW_MAX_BYTES = 800_000;
export const PREVIEW_SWEEP_BATCH = 10;

const MIN_VIDEO_MS = 3000;
const WHOLE_VIDEO_MAX_MS = 8000;
const CANDIDATE_SHARES = [0.2, 0.35, 0.5, 0.65, 0.8] as const;
const FRAME_OFFSET_MS = 3000;
const EARLIEST_START_MS = 1000;
const END_MARGIN_MS = 6500;

export type PreviewPlan =
  | { kind: 'skip'; reason: string }
  | { kind: 'clip'; startMs: number; lengthMs: number; candidates: number[] };

const roundTo100 = (ms: number) => Math.round(ms / 100) * 100;

/**
 * Where a preview clip comes from. Short videos use the whole file, longer ones offer five starting points
 * (the worker scores a frame 3 seconds into each and keeps the best), and an editor can pick one start.
 */
export function planPreview(input: {
  durationMs: number;
  mode: 'auto' | 'picked';
  startMs?: number | null;
}): PreviewPlan {
  const { durationMs } = input;
  if (!(durationMs >= MIN_VIDEO_MS)) return { kind: 'skip', reason: 'The video is under 3 seconds' };
  if (durationMs <= WHOLE_VIDEO_MAX_MS)
    return { kind: 'clip', startMs: 0, lengthMs: durationMs, candidates: [0] };
  if (input.mode === 'picked' && typeof input.startMs === 'number') {
    const start = Math.max(0, Math.min(roundTo100(input.startMs), durationMs - PREVIEW_CLIP_MS));
    return { kind: 'clip', startMs: start, lengthMs: PREVIEW_CLIP_MS, candidates: [start] };
  }
  const latest = Math.max(EARLIEST_START_MS, durationMs - END_MARGIN_MS);
  const candidates = [
    ...new Set(
      CANDIDATE_SHARES.map((share) =>
        Math.min(latest, Math.max(EARLIEST_START_MS, Math.round(durationMs * share) - FRAME_OFFSET_MS)),
      ),
    ),
  ];
  return { kind: 'clip', startMs: candidates[0]!, lengthMs: PREVIEW_CLIP_MS, candidates };
}

/** The point inside a candidate clip that is scored, so a black opening does not decide. */
export const previewScoreOffsetMs = FRAME_OFFSET_MS;

const seconds = (ms: number) => (ms / 1000).toFixed(3);

/** One silent, faststart H.264 file that every phone plays. Reads files only, through the same input guard as other jobs. */
export function previewArgs(options: {
  input: string;
  container: Container;
  startMs: number;
  lengthMs: number;
  output: string;
  crf?: number;
}): string[] {
  return [
    '-nostdin',
    '-hide_banner',
    '-y',
    '-loglevel',
    'error',
    '-ss',
    seconds(options.startMs),
    ...inputSafety(options.container),
    '-i',
    options.input,
    '-t',
    seconds(options.lengthMs),
    '-an',
    '-vf',
    `scale=${PREVIEW_WIDTH}:-2:flags=lanczos,fps=24,format=yuv420p`,
    '-c:v',
    'libx264',
    '-profile:v',
    'main',
    '-level',
    '3.1',
    '-preset',
    'slow',
    '-crf',
    String(options.crf ?? PREVIEW_CRF),
    '-maxrate',
    '900k',
    '-bufsize',
    '1800k',
    '-g',
    '48',
    '-keyint_min',
    '48',
    '-sc_threshold',
    '0',
    '-movflags',
    '+faststart',
    '-map_metadata',
    '-1',
    options.output,
  ];
}

/** Content hashed, so the url never changes for the same bytes and can be cached for a year. */
export function previewKey(mediaPrefix: string, startMs: number, bytes: Uint8Array): string {
  const sha8 = createHash('sha256').update(bytes).digest('hex').slice(0, 8);
  return `cap/${mediaPrefix}/preview/${startMs}-${sha8}.mp4`;
}
