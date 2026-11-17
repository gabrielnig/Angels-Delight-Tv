import { spawn } from 'node:child_process';
import { h264Level, type PlannedRung } from '../ladder';
import type { Container } from '../magic';

/** Forced input demuxers per sniffed container, so a crafted file cannot pick a risky demuxer (SECURITY section 8 step 5). */
export function demuxerFor(container: Container): string {
  return container === 'mp4' || container === 'mov' ? 'mov,mp4,m4a,3gp,3g2,mj2' : 'matroska,webm';
}

/** Flags that must come before -i: no network or playlist protocols, one demuxer family. */
function inputSafety(container: Container): string[] {
  return ['-protocol_whitelist', 'file', '-f', demuxerFor(container)];
}

export function ffprobeArgs(input: string, container: Container): string[] {
  return [
    '-v',
    'error',
    ...inputSafety(container),
    '-print_format',
    'json',
    '-show_format',
    '-show_streams',
    input,
  ];
}

export interface EncodeRungInput {
  input: string;
  container: Container;
  outDir: string;
  rung: PlannedRung;
  hasAudio: boolean;
  keyInfoPath: string;
  preset: string;
  threads: number;
}

/** One rung: scaled H.264, aligned keyframes, AES-128 encrypted 6 second MPEG-TS segments (ARCHITECTURE section 8.2). */
export function encodeRungArgs(options: EncodeRungInput): string[] {
  const { rung } = options;
  const level = (h264Level(rung.height) / 10).toFixed(1);
  const args = [
    '-nostdin',
    '-hide_banner',
    '-y',
    '-loglevel',
    'error',
    ...inputSafety(options.container),
    '-i',
    options.input,
    '-map',
    '0:v:0',
    ...(options.hasAudio ? ['-map', '0:a:0'] : []),
    '-map_metadata',
    '-1',
    '-map_chapters',
    '-1',
    '-vf',
    `scale=${rung.width}:${rung.height},setsar=1`,
    '-c:v',
    'libx264',
    '-preset',
    options.preset,
    '-profile:v',
    rung.profile,
    '-level:v',
    level,
    '-pix_fmt',
    'yuv420p',
    '-crf',
    '23',
    '-maxrate',
    `${rung.videoKbps}k`,
    '-bufsize',
    `${rung.videoKbps * 2}k`,
    '-sc_threshold',
    '0',
    '-force_key_frames',
    'expr:gte(t,n_forced*6)',
    ...(options.hasAudio
      ? [
          '-c:a',
          'aac',
          '-b:a',
          `${rung.audioKbps}k`,
          '-ac',
          '2',
          '-ar',
          '48000',
          '-af',
          'loudnorm=I=-16:TP=-1.5:LRA=11',
        ]
      : ['-an']),
    ...(options.threads > 0 ? ['-threads', String(options.threads)] : []),
    '-f',
    'hls',
    '-hls_time',
    '6',
    '-hls_playlist_type',
    'vod',
    '-hls_segment_type',
    'mpegts',
    '-hls_key_info_file',
    options.keyInfoPath,
    '-hls_segment_filename',
    `${options.outDir}/seg_%05d.ts`,
    '-start_number',
    '0',
    '-progress',
    'pipe:1',
    '-nostats',
    `${options.outDir}/index.m3u8`,
  ];
  return args;
}

export function thumbnailArgs(options: {
  input: string;
  container: Container;
  atSeconds: number;
  width: number;
  output: string;
}): string[] {
  return [
    '-nostdin',
    '-hide_banner',
    '-y',
    '-loglevel',
    'error',
    '-ss',
    options.atSeconds.toFixed(3),
    ...inputSafety(options.container),
    '-i',
    options.input,
    '-frames:v',
    '1',
    '-vf',
    `scale=${options.width}:-2`,
    '-c:v',
    'libwebp',
    '-quality',
    '80',
    options.output,
  ];
}

/** Mono 16 kHz PCM, the input faster-whisper expects (ARCHITECTURE section 9). */
export function extractAudioArgs(options: {
  input: string;
  container: Container;
  output: string;
}): string[] {
  return [
    '-nostdin',
    '-hide_banner',
    '-y',
    '-loglevel',
    'error',
    ...inputSafety(options.container),
    '-i',
    options.input,
    '-vn',
    '-ac',
    '1',
    '-ar',
    '16000',
    '-c:a',
    'pcm_s16le',
    options.output,
  ];
}

/** Reads `-progress pipe:1` output and returns the encoded media time in milliseconds when a block carries one. */
export class ProgressParser {
  private buffer = '';

  feed(chunk: string): number | null {
    this.buffer += chunk;
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop() ?? '';
    let latest: number | null = null;
    for (const line of lines) {
      const match = /^out_time_us=(\d+)$/.exec(line.trim());
      if (match) latest = Math.round(Number(match[1]) / 1000);
    }
    return latest;
  }
}

export function segmentBandwidths(segments: { bytes: number; seconds: number }[]): {
  peak: number;
  average: number;
} {
  const totalBits = segments.reduce((sum, s) => sum + s.bytes * 8, 0);
  const totalSeconds = segments.reduce((sum, s) => sum + s.seconds, 0);
  const peak = Math.max(...segments.map((s) => Math.round((s.bytes * 8) / s.seconds)));
  return { peak, average: Math.round(totalBits / totalSeconds) };
}

export interface RunOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
  onStdout?: (chunk: string) => void;
  /** Lowers CPU priority so encoding does not starve the website (M14-S07). */
  niceness?: number;
}

export interface RunResult {
  code: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
}

/** Runs a program with an argument array and no shell. Output is capped so a noisy tool cannot fill memory. */
export interface ProcessRunner {
  run(command: string, args: string[], options?: RunOptions): Promise<RunResult>;
}

const OUTPUT_CAP = 256 * 1024;

export const nodeRunner: ProcessRunner = {
  run(command, args, options = {}) {
    return new Promise((resolve, reject) => {
      const useNice = options.niceness !== undefined && process.platform !== 'win32';
      const child = useNice
        ? spawn('nice', ['-n', String(options.niceness), command, ...args], {
            stdio: ['ignore', 'pipe', 'pipe'],
          })
        : spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] });
      let stdout = '';
      let stderr = '';
      let timedOut = false;
      const timer = options.timeoutMs
        ? setTimeout(() => {
            timedOut = true;
            child.kill('SIGKILL');
          }, options.timeoutMs)
        : undefined;
      const abort = () => child.kill('SIGKILL');
      options.signal?.addEventListener('abort', abort, { once: true });

      child.stdout.setEncoding('utf8');
      child.stderr.setEncoding('utf8');
      child.stdout.on('data', (chunk: string) => {
        options.onStdout?.(chunk);
        if (stdout.length < OUTPUT_CAP) stdout += chunk;
      });
      child.stderr.on('data', (chunk: string) => {
        if (stderr.length < OUTPUT_CAP) stderr += chunk;
      });
      child.on('error', (error) => {
        if (timer) clearTimeout(timer);
        options.signal?.removeEventListener('abort', abort);
        reject(error);
      });
      child.on('close', (code) => {
        if (timer) clearTimeout(timer);
        options.signal?.removeEventListener('abort', abort);
        resolve({ code, stdout, stderr, timedOut });
      });
    });
  },
};
