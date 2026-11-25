import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const exec = promisify(execFile);

export interface VideoProbe {
  durationMs: number;
  bytes: number;
  width: number;
  height: number;
  codec: string;
  pixFmt: string;
  fps: number;
  audioStreams: number;
}

/** ffprobe summary of a video file. */
export async function probeVideo(file: string): Promise<VideoProbe> {
  const { stdout } = await exec('ffprobe', [
    '-v',
    'error',
    '-show_streams',
    '-show_format',
    '-of',
    'json',
    file,
  ]);
  const j = JSON.parse(stdout) as {
    streams: Array<{
      codec_type: string;
      codec_name: string;
      width?: number;
      height?: number;
      pix_fmt?: string;
      avg_frame_rate?: string;
    }>;
    format: { duration: string; size: string };
  };
  const v = j.streams.find((s) => s.codec_type === 'video');
  if (!v) throw new Error(`${file} has no video stream`);
  const [num, den] = (v.avg_frame_rate ?? '0/1').split('/').map(Number);
  return {
    durationMs: Math.round(Number(j.format.duration) * 1000),
    bytes: Number(j.format.size),
    width: v.width ?? 0,
    height: v.height ?? 0,
    codec: v.codec_name,
    pixFmt: v.pix_fmt ?? '',
    fps: den ? Math.round((num! / den) * 100) / 100 : 0,
    audioStreams: j.streams.filter((s) => s.codec_type === 'audio').length,
  };
}

export interface VideoLimits {
  minSeconds: number;
  maxSeconds: number;
  maxBytes: number;
}

/** The video rules of the plan: H.264, yuv420p, no audio, the profile's size, 1 to 4 minutes, under 5 MB. */
export function checkProbe(
  p: VideoProbe,
  limits: VideoLimits,
  expected: { width: number; height: number },
): string[] {
  const out: string[] = [];
  const s = p.durationMs / 1000;
  if (s < limits.minSeconds)
    out.push(`video is ${s.toFixed(1)} s, shorter than ${limits.minSeconds} s`);
  if (s > limits.maxSeconds)
    out.push(`video is ${s.toFixed(1)} s, longer than ${limits.maxSeconds} s`);
  if (p.bytes > limits.maxBytes) {
    out.push(
      `video is ${(p.bytes / 1024 / 1024).toFixed(1)} MB, over the ${Math.round(limits.maxBytes / 1024 / 1024)} MB limit`,
    );
  }
  if (p.audioStreams > 0) out.push(`video has ${p.audioStreams} audio stream, it must be silent`);
  if (p.codec !== 'h264') out.push(`video codec is ${p.codec}, it must be h264`);
  if (p.pixFmt !== 'yuv420p') out.push(`pixel format is ${p.pixFmt}, it must be yuv420p`);
  if (p.width !== expected.width || p.height !== expected.height) {
    out.push(`video is ${p.width}x${p.height}, it must be ${expected.width}x${expected.height}`);
  }
  return out;
}
