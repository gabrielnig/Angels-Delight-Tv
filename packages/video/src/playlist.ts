export interface PlaylistSegment {
  name: string;
  seconds: number;
}

const SEGMENT_NAME = /^[A-Za-z0-9_-]+\.ts$/;

/** Reads the variant playlist ffmpeg wrote, keeping only names and durations. Everything else is rebuilt by us. */
export function parseMediaPlaylist(text: string): { segments: PlaylistSegment[] } {
  const lines = text.split(/\r?\n/);
  const segments: PlaylistSegment[] = [];
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index] ?? '';
    if (!line.startsWith('#EXTINF:')) continue;
    const seconds = Number(line.slice('#EXTINF:'.length).split(',')[0]);
    const name = (lines[index + 1] ?? '').trim();
    if (!Number.isFinite(seconds) || seconds <= 0 || !SEGMENT_NAME.test(name)) {
      throw new Error(`Playlist has an invalid segment entry near line ${index + 1}`);
    }
    segments.push({ name, seconds });
  }
  if (segments.length === 0) throw new Error('Playlist has no segment entries');
  return { segments };
}

export function buildVariantTemplate(input: {
  videoId: string;
  segments: PlaylistSegment[];
}): string {
  const target = Math.ceil(Math.max(...input.segments.map((segment) => segment.seconds)));
  const lines = [
    '#EXTM3U',
    '#EXT-X-VERSION:3',
    `#EXT-X-TARGETDURATION:${target}`,
    '#EXT-X-MEDIA-SEQUENCE:0',
    '#EXT-X-PLAYLIST-TYPE:VOD',
    `#EXT-X-KEY:METHOD=AES-128,URI="ad-key://${input.videoId}"`,
  ];
  for (const segment of input.segments) {
    lines.push(`#EXTINF:${segment.seconds.toFixed(6)},`, segment.name);
  }
  lines.push('#EXT-X-ENDLIST', '');
  return lines.join('\n');
}

export interface RewriteVariantOptions {
  videoId: string;
  appOrigin: string;
  /** Builds the final segment url, normally a signed media url. */
  segmentUrl: (segmentName: string) => string;
  /** Extra query for the key url, such as `pt=...` for native HLS clients. */
  keyQuery?: string;
}

const KEY_LINE = /^#EXT-X-KEY:METHOD=AES-128,URI="ad-key:\/\/([^"]+)"$/;

/** Fails closed: any line the template builder could not have produced is an error, not a passthrough. */
export function rewriteVariant(template: string, options: RewriteVariantOptions): string {
  const origin = options.appOrigin.replace(/\/+$/, '');
  const out: string[] = [];
  for (const line of template.split('\n')) {
    if (line.startsWith('#EXT-X-KEY')) {
      const match = KEY_LINE.exec(line);
      if (!match || match[1] !== options.videoId)
        throw new Error('Playlist template has a bad key line');
      const query = options.keyQuery ? `?${options.keyQuery}` : '';
      out.push(`#EXT-X-KEY:METHOD=AES-128,URI="${origin}/api/hls/keys/${options.videoId}${query}"`);
    } else if (line === '' || line.startsWith('#')) {
      out.push(line);
    } else if (SEGMENT_NAME.test(line)) {
      out.push(options.segmentUrl(line));
    } else {
      throw new Error('Playlist template has an unexpected uri');
    }
  }
  return out.join('\n');
}

export interface MasterRung {
  height: number;
  width: number;
  bandwidthBps: number;
  avgBandwidthBps: number;
  codecs: string;
}

export function buildMasterTemplate(rungs: MasterRung[]): string {
  if (rungs.length === 0) throw new Error('A master playlist needs at least one rendition');
  const lines = ['#EXTM3U', '#EXT-X-VERSION:3'];
  for (const rung of [...rungs].sort((a, b) => a.height - b.height)) {
    lines.push(
      `#EXT-X-STREAM-INF:BANDWIDTH=${rung.bandwidthBps},AVERAGE-BANDWIDTH=${rung.avgBandwidthBps},RESOLUTION=${rung.width}x${rung.height},CODECS="${rung.codecs}"`,
      `${rung.height}.m3u8`,
    );
  }
  lines.push('');
  return lines.join('\n');
}

const VARIANT_LINE = /^(\d{3,4})\.m3u8$/;

export function rewriteMaster(
  template: string,
  options: { videoId: string; appOrigin: string; query?: string },
): string {
  const origin = options.appOrigin.replace(/\/+$/, '');
  const query = options.query ? `?${options.query}` : '';
  return template
    .split('\n')
    .map((line) => {
      const match = VARIANT_LINE.exec(line);
      if (match) return `${origin}/api/play/${options.videoId}/${match[1]}.m3u8${query}`;
      if (line === '' || line.startsWith('#')) return line;
      throw new Error('Master template has an unexpected uri');
    })
    .join('\n');
}
