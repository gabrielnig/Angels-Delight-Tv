import sharp from 'sharp';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { ProcessRunner, RunOptions, RunResult } from './encode/ffmpeg';

export interface FakeRunnerCall {
  command: string;
  args: string[];
}

export function fakeProbeJson(
  overrides: {
    width?: number;
    height?: number;
    seconds?: number;
    audio?: boolean;
    format?: string;
  } = {},
) {
  const {
    width = 1280,
    height = 720,
    seconds = 14,
    audio = true,
    format = 'mov,mp4,m4a,3gp,3g2,mj2',
  } = overrides;
  return {
    format: { format_name: format, duration: String(seconds) },
    streams: [
      { codec_type: 'video', codec_name: 'h264', width, height, avg_frame_rate: '25/1' },
      ...(audio ? [{ codec_type: 'audio', codec_name: 'aac', channels: 2 }] : []),
    ],
  };
}

/**
 * Stands in for ffprobe and ffmpeg. Encode calls write a small playlist and fake segment files where the real
 * tool would, so the orchestration can be tested without codecs.
 */
export class FakeRunner implements ProcessRunner {
  calls: FakeRunnerCall[] = [];
  probe: object = fakeProbeJson();
  /** Heights whose encode should fail. Cleared entries by deleting from the set. */
  failHeights = new Set<number>();
  segmentsPerRung = 3;
  probeExitCode = 0;
  /** How many sprite sheets the fake sprite step writes. */
  spriteSheets = 1;
  failSprites = false;
  /** Seconds into the source that the fake poster frame step was asked for, in order. */
  frameTimes: number[] = [];
  /** Decides what a poster frame looks like. Default: a sharp, well lit picture. */
  frame: (atSeconds: number) => 'good' | 'black' | 'blur' | 'broken' = () => 'good';

  encodeCalls(): number[] {
    return this.calls
      .filter((call) => call.args.includes('-hls_time'))
      .map((call) =>
        Number(call.args[call.args.indexOf('-vf') + 1]?.match(/scale=\d+:(\d+)/)?.[1]),
      );
  }

  async run(command: string, args: string[], options: RunOptions = {}): Promise<RunResult> {
    this.calls.push({ command, args });
    const done = (code: number, stdout = '', stderr = ''): RunResult => ({
      code,
      stdout,
      stderr,
      timedOut: false,
    });

    if (command.endsWith('ffprobe')) {
      return this.probeExitCode === 0
        ? done(0, JSON.stringify(this.probe))
        : done(this.probeExitCode, '', 'moov atom not found');
    }

    if (args.includes('-hls_time')) {
      const height = Number(args[args.indexOf('-vf') + 1]?.match(/scale=\d+:(\d+)/)?.[1]);
      if (this.failHeights.has(height)) return done(1, '', 'Conversion failed');
      const outDir = dirname(args[args.length - 1]!);
      let playlist =
        '#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-TARGETDURATION:6\n#EXT-X-MEDIA-SEQUENCE:0\n';
      for (let index = 0; index < this.segmentsPerRung; index++) {
        const name = `seg_${String(index).padStart(5, '0')}.ts`;
        await mkdir(outDir, { recursive: true });
        await writeFile(join(outDir, name), Buffer.alloc(1000 * (index + 1) + height, index));
        playlist += `#EXTINF:6.000000,\n${name}\n`;
        options.onStdout?.(`out_time_us=${(index + 1) * 4_000_000}\nprogress=continue\n`);
      }
      await writeFile(join(outDir, 'index.m3u8'), `${playlist}#EXT-X-ENDLIST\n`);
      return done(0);
    }

    if (args.some((arg) => arg.includes('tile='))) {
      if (this.failSprites) return done(1, '', 'sprite failed');
      const pattern = args[args.length - 1]!;
      await mkdir(dirname(pattern), { recursive: true });
      for (let n = 1; n <= this.spriteSheets; n++)
        await writeFile(
          pattern.replace('%03d', String(n).padStart(3, '0')),
          Buffer.from(`sheet-${n}`),
        );
      return done(0);
    }

    const output = args[args.length - 1]!;
    await mkdir(dirname(output), { recursive: true });
    if (output.endsWith('.webp') && args.includes('-ss')) {
      const at = Number(args[args.indexOf('-ss') + 1]);
      this.frameTimes.push(at);
      await writeFile(output, await fakeFrame(this.frame(at)));
      return done(0);
    }
    await writeFile(output, Buffer.from(`fake-output:${output}`));
    return done(0);
  }
}

/** A small real picture, so the poster scoring has something to read. */
export async function fakeFrame(kind: 'good' | 'black' | 'blur' | 'broken'): Promise<Buffer> {
  if (kind === 'broken') return Buffer.from('not a picture');
  const width = 320;
  const height = 180;
  const raw = Buffer.alloc(width * height * 3);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const value = kind === 'black' ? 0 : Math.floor(x / 4) % 2 === 0 ? 40 : 210;
      raw.fill(value, (y * width + x) * 3, (y * width + x) * 3 + 3);
    }
  let image = sharp(raw, { raw: { width, height, channels: 3 } });
  if (kind === 'blur') image = image.blur(10);
  return image.webp({ quality: 80 }).toBuffer();
}

/** The first bytes of an mp4 file, enough for the magic byte check. */
export function fakeMp4Bytes(size = 2048): Uint8Array {
  const bytes = new Uint8Array(size);
  bytes.set([0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d], 0);
  return bytes;
}
