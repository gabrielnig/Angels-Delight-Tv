import { z } from 'zod';

export interface RungSpec {
  height: number;
  videoKbps: number;
  audioKbps: number;
  profile: 'main' | 'high';
}

export interface PlannedRung extends RungSpec {
  width: number;
}

/** ARCHITECTURE section 8.1. Values are starting points, the live ladder comes from the `video.ladder` setting. */
export const DEFAULT_LADDER: RungSpec[] = [
  { height: 360, videoKbps: 500, audioKbps: 96, profile: 'main' },
  { height: 480, videoKbps: 900, audioKbps: 96, profile: 'main' },
  { height: 720, videoKbps: 1800, audioKbps: 128, profile: 'high' },
  { height: 1080, videoKbps: 3500, audioKbps: 128, profile: 'high' },
];

const rungSchema = z.object({
  height: z.number().int().min(144).max(2160),
  videoKbps: z.number().int().min(50).max(50_000),
  audioKbps: z.number().int().min(32).max(512),
  profile: z.enum(['main', 'high']),
});

/** Validates a ladder from settings. Sorted ascending so the master playlist order is stable. */
export function parseLadderConfig(input: unknown): RungSpec[] {
  const rungs = z.array(rungSchema).min(1).max(8).parse(input);
  const heights = new Set(rungs.map((rung) => rung.height));
  if (heights.size !== rungs.length) throw new Error('Ladder has a duplicate height');
  return [...rungs].sort((a, b) => a.height - b.height);
}

const even = (value: number) => Math.max(2, 2 * Math.round(value / 2));

function widthFor(source: { width: number; height: number }, height: number): number {
  return even((height * source.width) / source.height);
}

/**
 * Rungs at or below the source height only. A source under the lowest rung gets one rung at its own
 * (even) height, using the lowest rung's bitrates. Widths follow the source aspect ratio.
 */
export function planLadder(
  source: { width: number; height: number },
  ladder: RungSpec[] = DEFAULT_LADDER,
): PlannedRung[] {
  const sorted = [...ladder].sort((a, b) => a.height - b.height);
  const chosen = sorted.filter((rung) => rung.height <= source.height);
  if (chosen.length > 0) {
    return chosen.map((rung) => ({ ...rung, width: widthFor(source, rung.height) }));
  }
  const lowest = sorted[0];
  if (!lowest) throw new Error('Ladder is empty');
  const height = Math.max(2, source.height - (source.height % 2));
  return [{ ...lowest, height, width: widthFor(source, height) }];
}

const LEVEL_BY_HEIGHT: [number, number][] = [
  [480, 0x1e],
  [720, 0x1f],
  [Infinity, 0x28],
];

export function h264Level(height: number): number {
  return LEVEL_BY_HEIGHT.find(([max]) => height <= max)?.[1] ?? 0x28;
}

/** RFC 6381 codecs string for a rung, matching the -profile and -level given to ffmpeg. */
export function codecsFor(rung: Pick<RungSpec, 'height' | 'profile'>, hasAudio: boolean): string {
  const profileByte = rung.profile === 'high' ? '64' : '4d';
  const level = h264Level(rung.height).toString(16).padStart(2, '0');
  const video = `avc1.${profileByte}00${level}`;
  return hasAudio ? `${video},mp4a.40.2` : video;
}
