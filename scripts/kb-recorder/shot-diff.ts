import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';

const exec = promisify(execFile);

export interface Mask {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DiffResult {
  /** Share of all pixels that moved by more than the tolerance, 0 to 1. Pixels under a mask never count as changed. */
  ratio: number;
  /** The comparison as RGBA: the new picture faded, changed pixels in red. */
  picture: Buffer;
}

/** Compares two RGBA buffers of the same size. A pixel counts as changed when any channel moved by more than `tolerance`. */
export function diffRaw(
  a: Buffer,
  b: Buffer,
  width: number,
  height: number,
  o: { tolerance?: number; masks?: Mask[] } = {},
): DiffResult {
  const tol = o.tolerance ?? 10;
  const masks = o.masks ?? [];
  const picture = Buffer.alloc(width * height * 4);
  let changed = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const masked = masks.some(
        (m) => x >= m.x && x < m.x + m.width && y >= m.y && y < m.y + m.height,
      );
      const moved =
        Math.abs(a[i]! - b[i]!) > tol ||
        Math.abs(a[i + 1]! - b[i + 1]!) > tol ||
        Math.abs(a[i + 2]! - b[i + 2]!) > tol;
      if (moved && !masked) {
        changed++;
        picture.set([255, 0, 0, 255], i);
      } else {
        // Fade the new picture so the red stands out.
        picture.set(
          [
            Math.round(b[i]! * 0.4 + 153),
            Math.round(b[i + 1]! * 0.4 + 153),
            Math.round(b[i + 2]! * 0.4 + 153),
            255,
          ],
          i,
        );
      }
    }
  }
  return { ratio: changed / (width * height), picture };
}

async function sizeOf(file: string): Promise<{ width: number; height: number }> {
  const { stdout } = await exec('ffprobe', [
    '-v',
    'error',
    '-select_streams',
    'v:0',
    '-show_entries',
    'stream=width,height',
    '-of',
    'csv=p=0',
    file,
  ]);
  const [width, height] = stdout.trim().split(',').map(Number);
  return { width: width!, height: height! };
}

function decode(file: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const p = spawn('ffmpeg', [
      '-v',
      'error',
      '-i',
      file,
      '-frames:v',
      '1',
      '-f',
      'rawvideo',
      '-pix_fmt',
      'rgba',
      '-',
    ]);
    const chunks: Buffer[] = [];
    let err = '';
    p.stdout.on('data', (d: Buffer) => chunks.push(d));
    p.stderr.on('data', (d) => (err += String(d)));
    p.on('error', reject);
    p.on('close', (code) =>
      code === 0
        ? resolve(Buffer.concat(chunks))
        : reject(new Error(`ffmpeg failed on ${file}: ${err.slice(-300)}`)),
    );
  });
}

function writePng(raw: Buffer, width: number, height: number, out: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const p = spawn('ffmpeg', [
      '-y',
      '-v',
      'error',
      '-f',
      'rawvideo',
      '-pix_fmt',
      'rgba',
      '-s',
      `${width}x${height}`,
      '-i',
      '-',
      '-frames:v',
      '1',
      out,
    ]);
    let err = '';
    p.stderr.on('data', (d) => (err += String(d)));
    p.on('error', reject);
    p.on('close', (code) =>
      code === 0
        ? resolve()
        : reject(new Error(`ffmpeg failed writing ${out}: ${err.slice(-300)}`)),
    );
    p.stdin.end(raw);
  });
}

export interface CompareResult {
  ratio: number;
  sizeChanged: boolean;
}

/** Compares two picture files. A different size is a full change without comparing pixels. Writes a diff PNG when asked. */
export async function compareImages(
  baseline: string,
  current: string,
  o: { tolerance?: number; masks?: Mask[]; diffOut?: string } = {},
): Promise<CompareResult> {
  const [sa, sb] = await Promise.all([sizeOf(baseline), sizeOf(current)]);
  if (sa.width !== sb.width || sa.height !== sb.height) return { ratio: 1, sizeChanged: true };
  const [a, b] = await Promise.all([decode(baseline), decode(current)]);
  const r = diffRaw(a, b, sb.width, sb.height, o);
  if (o.diffOut && r.ratio > 0) await writePng(r.picture, sb.width, sb.height, o.diffOut);
  return { ratio: r.ratio, sizeChanged: false };
}
