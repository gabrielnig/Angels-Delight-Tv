import 'server-only';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { Readable, Transform } from 'node:stream';
import { findContentDir } from '@ad/help/node';
import { adminRuntime } from '@/server/admin/runtime';
import { isSampleInProduction, type FileSource, type VideoSource } from './video';

/** The media release the pages play from. `sample` is the placeholder set committed with the content (D-376). */
export const helpMediaRelease = (): string => process.env.HELP_MEDIA_RELEASE?.trim() || 'sample';

/** True when this site is live but still plays the placeholder video, so the guide pages can say so. */
export const helpMediaIsSample = (): boolean =>
  isSampleInProduction(helpMediaRelease(), process.env.NODE_ENV);

/** Skips the bytes before `start` and stops after `end`, for stores that can only stream a whole object. */
function slice(from: Readable, start: number, end: number): Readable {
  let seen = 0;
  const cut = new Transform({
    transform(chunk: Buffer, _enc, done) {
      const first = seen;
      seen += chunk.length;
      if (seen <= start || first > end) return done();
      done(
        null,
        chunk.subarray(Math.max(start - first, 0), Math.min(end - first + 1, chunk.length)),
      );
    },
  });
  from.on('error', (e) => cut.destroy(e));
  return from.pipe(cut);
}

/** Opens a placeholder file or a private storage object. Returns null when it does not exist. */
export async function openVideoSource(source: VideoSource): Promise<FileSource | null> {
  if (source.kind === 'placeholder') {
    const file = join(findContentDir(), 'placeholder', source.name);
    if (!existsSync(file)) return null;
    return {
      size: statSync(file).size,
      open: (start, end) => createReadStream(file, { start, end }),
    };
  }
  const storage = adminRuntime().originals();
  const info = await storage.head(source.key);
  if (!info) return null;
  return {
    size: info.bytes,
    open: (start, end) => {
      const stream = new Readable({ read() {} });
      storage
        .get(source.key)
        .then((body) => (start === 0 && end >= info.bytes - 1 ? body : slice(body, start, end)))
        .then((body) => {
          body.on('data', (c) => stream.push(c));
          body.on('end', () => stream.push(null));
          body.on('error', (e) => stream.destroy(e));
        })
        .catch((e) => stream.destroy(e));
      return stream;
    },
  };
}

/** The whole text of a small file such as the captions, or null. */
export async function readVideoText(source: VideoSource): Promise<string | null> {
  const file = await openVideoSource(source);
  if (!file) return null;
  const chunks: Buffer[] = [];
  for await (const c of file.open(0, Math.max(file.size - 1, 0))) chunks.push(c as Buffer);
  return Buffer.concat(chunks).toString('utf8');
}
