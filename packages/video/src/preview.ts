import { createHash } from 'node:crypto';
import { inputSafety } from './encode/ffmpeg';
import type { Container } from './magic';

/**
 * Worker constants for the Home hero preview clip (M41-S11, plan 4.3). The length is the site setting
 * `home.hero_clip_seconds` (D-352, supersedes the 6 second plan value); these are its default and bounds.
 */
export const PREVIEW_CLIP_MS = 20_000;
export const PREVIEW_CLIP_MIN_MS = 6000;
export const PREVIEW_CLIP_MAX_MS = 30_000;
/** Low bitrate AAC kept in the clip so a viewer can choose to hear it. Mono sources are upmixed to two channels. */
export const PREVIEW_AUDIO_BITRATE = '48k';
export const PREVIEW_WIDTH = 854;
export const PREVIEW_CRF = 27;
export const PREVIEW_RETRY_CRF = 31;
/** About 105 KB a second at the 900 kbit/s video cap plus audio, rounded up to 120 KB a second so a busy scene is not refused. */
export const PREVIEW_MAX_BYTES_PER_SECOND = 120_000;
export const PREVIEW_SWEEP_BATCH = 10;

const MIN_VIDEO_MS = 3000;
const CANDIDATE_SHARES = [0.2, 0.35, 0.5, 0.65, 0.8] as const;
const FRAME_OFFSET_MS = 3000;
const EARLIEST_START_MS = 1000;
const END_MARGIN_MS = 500;

export type PreviewPlan =
  | { kind: 'skip'; reason: string }
  | { kind: 'clip'; startMs: number; lengthMs: number; candidates: number[] };

const roundTo100 = (ms: number) => Math.round(ms / 100) * 100;

/** The clip length setting kept inside 6 to 30 seconds. Anything that is not a number gives the default. */
export function clampClipMs(ms: number): number {
  if (!Number.isFinite(ms)) return PREVIEW_CLIP_MS;
  return Math.min(PREVIEW_CLIP_MAX_MS, Math.max(PREVIEW_CLIP_MIN_MS, Math.round(ms)));
}

/** The largest clip file accepted for a length. Over this the encode is retried once at a higher crf. */
export const previewMaxBytes = (lengthMs: number) => Math.round((lengthMs / 1000) * PREVIEW_MAX_BYTES_PER_SECOND);

/**
 * Where a preview clip comes from. A video no longer than the clip length plays whole, longer ones offer five
 * starting points (the worker scores a frame 3 seconds into each and keeps the best), and an editor can pick one start.
 */
export function planPreview(input: {
  durationMs: number;
  mode: 'auto' | 'picked';
  startMs?: number | null;
  /** The clip length setting, 6 to 30 seconds. Defaults to 20. */
  clipMs?: number;
}): PreviewPlan {
  const { durationMs } = input;
  const clipMs = clampClipMs(input.clipMs ?? PREVIEW_CLIP_MS);
  if (!(durationMs >= MIN_VIDEO_MS)) return { kind: 'skip', reason: 'The video is under 3 seconds' };
  if (durationMs <= clipMs) return { kind: 'clip', startMs: 0, lengthMs: durationMs, candidates: [0] };
  if (input.mode === 'picked' && typeof input.startMs === 'number') {
    const start = Math.max(0, Math.min(roundTo100(input.startMs), durationMs - clipMs));
    return { kind: 'clip', startMs: start, lengthMs: clipMs, candidates: [start] };
  }
  const latest = Math.max(EARLIEST_START_MS, durationMs - clipMs - END_MARGIN_MS);
  const candidates = [
    ...new Set(
      CANDIDATE_SHARES.map((share) =>
        Math.min(latest, Math.max(EARLIEST_START_MS, Math.round(durationMs * share) - FRAME_OFFSET_MS)),
      ),
    ),
  ];
  return { kind: 'clip', startMs: candidates[0]!, lengthMs: clipMs, candidates };
}

/** The point inside a candidate clip that is scored, so a black opening does not decide. */
export const previewScoreOffsetMs = FRAME_OFFSET_MS;

const seconds = (ms: number) => (ms / 1000).toFixed(3);

/**
 * One faststart H.264 file that every phone plays, with a low bitrate AAC track when the source has audio (the
 * viewer can unmute, D-353). Reads files only, through the same input guard as other jobs.
 */
export function previewArgs(options: {
  input: string;
  container: Container;
  startMs: number;
  lengthMs: number;
  output: string;
  /** The source has an audio stream. Without one the clip is silent and no sound button is offered. */
  hasAudio: boolean;
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
    ...(options.hasAudio
      ? ['-map', '0:v:0', '-map', '0:a:0', '-c:a', 'aac', '-b:a', PREVIEW_AUDIO_BITRATE, '-ac', '2', '-ar', '44100']
      : ['-an']),
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
