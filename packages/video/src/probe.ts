import type { Container } from './magic';
import type { FailureCode } from './failure';

export interface ProbeResult {
  formatName: string;
  durationMs: number;
  width: number;
  height: number;
  frameRate: number;
  videoCodec: string;
  audioCodec: string | null;
  hasAudio: boolean;
  streamCount: number;
}

export interface ProbeLimits {
  maxSeconds: number;
  /** Above this the upload is allowed with a warning (M13-S07 AC4). */
  warnSeconds: number;
}

type Json = Record<string, unknown>;

const asObject = (value: unknown): Json | null =>
  value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Json) : null;
const asNumber = (value: unknown): number => {
  const n = typeof value === 'string' ? Number(value) : value;
  return typeof n === 'number' && Number.isFinite(n) ? n : 0;
};

function frameRate(stream: Json): number {
  const text = String(stream.avg_frame_rate ?? stream.r_frame_rate ?? '0/1');
  const [num, den] = text.split('/').map(Number);
  if (!num || !den) return 0;
  return Math.round((num / den) * 1000) / 1000;
}

function rotationOf(stream: Json): number {
  const list = Array.isArray(stream.side_data_list) ? stream.side_data_list : [];
  for (const item of list) {
    const rotation = asObject(item)?.rotation;
    if (typeof rotation === 'number') return ((Math.round(rotation) % 360) + 360) % 360;
  }
  const tag = asNumber(asObject(stream.tags)?.rotate);
  return ((tag % 360) + 360) % 360;
}

/** Reads the JSON from `ffprobe -print_format json -show_format -show_streams`. */
export function parseFfprobe(raw: unknown): ProbeResult {
  const root = asObject(raw);
  const format = asObject(root?.format);
  if (!root || !format) throw new Error('ffprobe output was not in the expected shape');
  const streams = (Array.isArray(root.streams) ? root.streams : [])
    .map(asObject)
    .filter((stream): stream is Json => stream !== null);
  const video = streams.find((stream) => stream.codec_type === 'video');
  const audio = streams.find((stream) => stream.codec_type === 'audio');

  let width = asNumber(video?.width);
  let height = asNumber(video?.height);
  if (video) {
    const rotation = rotationOf(video);
    if (rotation === 90 || rotation === 270) [width, height] = [height, width];
  }
  return {
    formatName: String(format.format_name ?? ''),
    durationMs: Math.round(asNumber(format.duration) * 1000),
    width,
    height,
    frameRate: video ? frameRate(video) : 0,
    videoCodec: video ? String(video.codec_name ?? '') : '',
    audioCodec: audio ? String(audio.codec_name ?? '') : null,
    hasAudio: Boolean(audio),
    streamCount: streams.length,
  };
}

export type ProbeVerdict =
  { ok: true; warnings: string[] } | { ok: false; code: FailureCode; detail: string };

const FORMATS: Record<Container, string[]> = {
  mp4: ['mov', 'mp4'],
  mov: ['mov', 'mp4'],
  matroska: ['matroska'],
  webm: ['matroska', 'webm'],
};

const MAX_STREAMS = 16;
const MIN_SIDE = 144;
const MAX_SIDE = 8192;

/** SECURITY section 8 step 4: format allowlist matching the sniffed bytes, a video stream, sane size and length. */
export function validateProbe(
  probe: ProbeResult,
  sniffed: Container,
  limits: ProbeLimits,
): ProbeVerdict {
  const names = probe.formatName.split(',');
  const allowed = FORMATS[sniffed];
  if (!names.some((name) => allowed.includes(name))) {
    return { ok: false, code: 'unsupported_format', detail: `format ${probe.formatName}` };
  }
  if (probe.streamCount > MAX_STREAMS) {
    return { ok: false, code: 'unreadable_file', detail: `${probe.streamCount} streams` };
  }
  if (!probe.videoCodec) {
    return { ok: false, code: 'no_video_stream', detail: 'no video stream' };
  }
  if (probe.durationMs <= 0) {
    return { ok: false, code: 'unreadable_file', detail: 'zero or missing duration' };
  }
  if (probe.durationMs > limits.maxSeconds * 1000) {
    return { ok: false, code: 'too_long', detail: `${probe.durationMs} ms` };
  }
  const small = Math.min(probe.width, probe.height);
  const large = Math.max(probe.width, probe.height);
  if (small < MIN_SIDE || large > MAX_SIDE) {
    return { ok: false, code: 'bad_dimensions', detail: `${probe.width}x${probe.height}` };
  }
  const warnings: string[] = [];
  if (probe.durationMs > limits.warnSeconds * 1000) {
    warnings.push(
      'This platform is built for short videos. A long file will take much longer to process.',
    );
  }
  return { ok: true, warnings };
}
