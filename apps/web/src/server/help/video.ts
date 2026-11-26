import type { Readable } from 'node:stream';
import { Readable as NodeReadable } from 'node:stream';

/** A readable file with a size and a way to open a byte range. Placeholder files and storage objects both fit. */
export interface FileSource {
  size: number;
  open(start: number, end: number): Readable;
}

const FILE =
  /^(V[SDWCMKTR]\d{2})-(720|480|phone-720)\.mp4$|^(V[SDWCMKTR]\d{2})-poster\.webp$|^(V[SDWCMKTR]\d{2})-captions\.vtt$/;

/** The content type for a file of this video, or null when the name is not one a help video has (M50-S07). */
export function videoFileType(videoId: string, name: string): string | null {
  if (!/^V[SDWCMKTR]\d{2}$/.test(videoId)) return null;
  const m = FILE.exec(name);
  if (!m) return null;
  if ((m[1] ?? m[3] ?? m[4]) !== videoId) return null;
  return name.endsWith('.mp4')
    ? 'video/mp4'
    : name.endsWith('.webp')
      ? 'image/webp'
      : 'text/vtt; charset=utf-8';
}

/** True when a production site would play the placeholder video for every guide (the release was never set). */
export const isSampleInProduction = (release: string, nodeEnv: string | undefined): boolean =>
  nodeEnv === 'production' && release === 'sample';

export type VideoSource = { kind: 'placeholder'; name: string } | { kind: 'storage'; key: string };

/** The release `sample` serves the committed placeholder files. A real release is read from private storage under help/<release>/. */
export function resolveVideoSource(release: string, videoId: string, name: string): VideoSource {
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,40}$/.test(release))
    throw new Error('The help media release is not a plain tag.');
  if (release === 'sample') {
    const placeholder = name.endsWith('.vtt')
      ? 'placeholder-captions.vtt'
      : name.endsWith('.webp')
        ? 'placeholder-poster.webp'
        : name.includes('480')
          ? 'placeholder-480.mp4'
          : 'placeholder-720.mp4';
    return { kind: 'placeholder', name: placeholder };
  }
  return { kind: 'storage', key: `help/${release}/${videoId}/${name}` };
}

export function parseRange(
  header: string | null,
  size: number,
): { start: number; end: number } | 'unsatisfiable' | null {
  if (!header) return null;
  const m = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!m || (m[1] === '' && m[2] === '')) return null;
  let start: number;
  let end: number;
  if (m[1] === '') {
    const n = Number(m[2]);
    if (n === 0) return 'unsatisfiable';
    start = Math.max(size - n, 0);
    end = size - 1;
  } else {
    start = Number(m[1]);
    end = m[2] === '' ? size - 1 : Math.min(Number(m[2]), size - 1);
  }
  if (start >= size || start > end) return 'unsatisfiable';
  return { start, end };
}

/** Serves a file with Range support. Always private: a signed in staff session is checked before this is called. */
export function serveVideo(
  source: FileSource,
  contentType: string,
  rangeHeader: string | null,
  base: Record<string, string>,
): Response {
  const headers = {
    'cache-control': 'private, max-age=3600',
    ...base,
    'content-type': contentType,
    'accept-ranges': 'bytes',
  };
  const range = parseRange(rangeHeader, source.size);
  if (range === 'unsatisfiable') {
    return new Response(null, {
      status: 416,
      headers: { ...headers, 'content-range': `bytes */${source.size}` },
    });
  }
  const web = (r: Readable) => NodeReadable.toWeb(r) as ReadableStream;
  if (!range) {
    return new Response(web(source.open(0, Math.max(source.size - 1, 0))), {
      status: 200,
      headers: { ...headers, 'content-length': String(source.size) },
    });
  }
  return new Response(web(source.open(range.start, range.end)), {
    status: 206,
    headers: {
      ...headers,
      'content-range': `bytes ${range.start}-${range.end}/${source.size}`,
      'content-length': String(range.end - range.start + 1),
    },
  });
}

export interface VttCue {
  start: number;
  end: number;
  text: string;
}

const seconds = (t: string) => {
  const parts = t.split(':').map(Number);
  return parts.length === 3
    ? parts[0]! * 3600 + parts[1]! * 60 + parts[2]!
    : parts[0]! * 60 + parts[1]!;
};

/** The cues of a WebVTT file, for the transcript under the video. */
export function parseVtt(text: string): VttCue[] {
  const cues: VttCue[] = [];
  for (const block of text.replace(/\r\n/g, '\n').split(/\n{2,}/)) {
    const lines = block.split('\n').filter(Boolean);
    const at = lines.findIndex((l) => l.includes('-->'));
    if (at < 0) continue;
    const m = /^([\d:.]+)\s+-->\s+([\d:.]+)/.exec(lines[at]!);
    if (!m) continue;
    cues.push({
      start: seconds(m[1]!),
      end: seconds(m[2]!),
      text: lines
        .slice(at + 1)
        .join(' ')
        .trim(),
    });
  }
  return cues;
}
