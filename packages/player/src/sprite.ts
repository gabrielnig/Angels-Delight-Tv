export interface SpriteTile {
  start: number;
  end: number;
  /** Absolute url of the sheet. */
  url: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

const TIME = /^(?:(\d+):)?(\d{2}):(\d{2})\.(\d{3})$/;

function seconds(text: string): number | null {
  const m = TIME.exec(text.trim());
  if (!m) return null;
  return Number(m[1] ?? 0) * 3600 + Number(m[2]) * 60 + Number(m[3]) + Number(m[4]) / 1000;
}

/** Reads the seek preview map made by the encoder. Anything odd is skipped: a bad map only means no previews. */
export function parseSpriteVtt(text: string, mapUrl: string): SpriteTile[] {
  if (!text.trimStart().startsWith('WEBVTT')) return [];
  let base: URL;
  try {
    base = new URL(mapUrl);
  } catch {
    return [];
  }
  const tiles: SpriteTile[] = [];
  for (const block of text.split(/\r?\n\r?\n/)) {
    const lines = block.split(/\r?\n/).filter(Boolean);
    const at = lines.findIndex((line) => line.includes('-->'));
    if (at < 0 || !lines[at + 1]) continue;
    const [from, to] = lines[at]!.split('-->').map((part) =>
      seconds(part.split(' ').filter(Boolean)[0] ?? ''),
    );
    const target = lines[at + 1]!.trim();
    const [path, fragment] = target.split('#');
    const rect = /^xywh=(\d+),(\d+),(\d+),(\d+)$/.exec(fragment ?? '');
    if (from === null || from === undefined || to === null || to === undefined || !path || !rect)
      continue;
    let url: URL;
    try {
      url = new URL(path, base);
    } catch {
      continue;
    }
    if (url.origin !== base.origin) continue;
    tiles.push({
      start: from,
      end: to,
      url: url.toString(),
      x: Number(rect[1]),
      y: Number(rect[2]),
      width: Number(rect[3]),
      height: Number(rect[4]),
    });
  }
  return tiles;
}

/** The tile for a time. A gap uses the nearest earlier tile, and the end of the video the last one. */
export function findTile(tiles: readonly SpriteTile[], time: number): SpriteTile | null {
  if (tiles.length === 0) return null;
  let lo = 0;
  let hi = tiles.length - 1;
  let found = 0;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (tiles[mid]!.start <= time) {
      found = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return tiles[found]!;
}

type Fetcher = (url: string) => Promise<Response>;

/** Loads the map on first use. Failure is silent (M08-S29) and is not retried for this page view. */
export class SpriteLoader {
  tiles: SpriteTile[] = [];
  private started: Promise<void> | null = null;

  constructor(
    private readonly url: string,
    private readonly fetcher: Fetcher = (u) => fetch(u),
  ) {}

  load(): Promise<void> {
    this.started ??= (async () => {
      try {
        const response = await this.fetcher(this.url);
        if (!response.ok) return;
        this.tiles = parseSpriteVtt(await response.text(), this.url);
      } catch {
        this.tiles = [];
      }
    })();
    return this.started;
  }
}
