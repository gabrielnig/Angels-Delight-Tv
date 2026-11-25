import { spawn } from 'node:child_process';
import { statSync } from 'node:fs';

export const MAX_IMAGE_BYTES = 120 * 1024;

function run(cmd: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let err = '';
    p.stderr.on('data', (d) => (err += String(d)));
    p.on('error', reject);
    p.on('close', (code) =>
      code === 0 ? resolve() : reject(new Error(`${cmd} exited ${code}\n${err.slice(-800)}`)),
    );
  });
}

/**
 * Converts a capture to WebP at a fixed width with no metadata, lowering quality until it is within the size budget
 * (120 KB, plan section 6.1). Fails when even the lowest quality is too big.
 */
export async function pngToWebp(
  input: string,
  output: string,
  o: { width: number; maxBytes?: number },
): Promise<{ bytes: number; quality: number }> {
  const max = o.maxBytes ?? MAX_IMAGE_BYTES;
  for (const quality of [88, 80, 72, 64, 56, 48, 40]) {
    await run('ffmpeg', [
      '-y',
      '-v',
      'error',
      '-i',
      input,
      '-vf',
      `scale=${o.width}:-2:flags=lanczos`,
      '-frames:v',
      '1',
      '-map_metadata',
      '-1',
      '-c:v',
      'libwebp',
      '-quality',
      String(quality),
      '-compression_level',
      '6',
      output,
    ]);
    const bytes = statSync(output).size;
    if (bytes <= max) return { bytes, quality };
  }
  throw new Error(
    `${output} cannot fit the ${Math.round(max / 1024)} KB budget at width ${o.width}`,
  );
}

/** RIFF chunk names of a WebP file, in order. Used to prove no EXIF, XMP or colour profile chunk is left. */
export function webpChunks(buf: Buffer): string[] {
  if (
    buf.length < 12 ||
    buf.toString('ascii', 0, 4) !== 'RIFF' ||
    buf.toString('ascii', 8, 12) !== 'WEBP'
  ) {
    throw new Error('Not a WebP file');
  }
  const names: string[] = [];
  let at = 12;
  while (at + 8 <= buf.length) {
    names.push(buf.toString('ascii', at, at + 4));
    const size = buf.readUInt32LE(at + 4);
    at += 8 + size + (size % 2);
  }
  return names;
}

/** Pixel size from a lossy, lossless or extended WebP header. */
export function webpSize(buf: Buffer): { width: number; height: number } {
  const kind = buf.toString('ascii', 12, 16);
  if (kind === 'VP8X') {
    return { width: 1 + buf.readUIntLE(24, 3), height: 1 + buf.readUIntLE(27, 3) };
  }
  if (kind === 'VP8 ') {
    return { width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff };
  }
  if (kind === 'VP8L') {
    const b = buf.readUInt32LE(21);
    return { width: (b & 0x3fff) + 1, height: ((b >> 14) & 0x3fff) + 1 };
  }
  throw new Error('Unknown WebP format');
}
