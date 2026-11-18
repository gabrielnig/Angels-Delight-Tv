import { describe, expect, it, vi } from 'vitest';
import { SpriteLoader, findTile, parseSpriteVtt } from './sprite';

const VTT = `WEBVTT

00:00:00.000 --> 00:00:05.000
sheet-1-aa.jpg#xywh=0,0,160,90

00:00:05.000 --> 00:00:10.000
sheet-1-aa.jpg#xywh=160,0,160,90

00:02:05.000 --> 00:02:10.000
sheet-2-bb.jpg#xywh=0,0,160,90
`;

describe('parseSpriteVtt', () => {
  const tiles = parseSpriteVtt(VTT, 'https://m.test/cap/p/sprites/map-1.vtt');

  it('resolves sheet urls against the map url and reads the tile rectangle', () => {
    expect(tiles).toHaveLength(3);
    expect(tiles[1]).toEqual({
      start: 5,
      end: 10,
      url: 'https://m.test/cap/p/sprites/sheet-1-aa.jpg',
      x: 160,
      y: 0,
      width: 160,
      height: 90,
    });
    expect(tiles[2]!.start).toBe(125);
  });

  it('skips cues it cannot read instead of failing', () => {
    expect(parseSpriteVtt('WEBVTT\n\n00:00:00.000 --> 00:00:05.000\nno-rectangle.jpg\n', 'https://a/b.vtt')).toEqual([]);
    expect(parseSpriteVtt('garbage', 'https://a/b.vtt')).toEqual([]);
  });

  it('refuses sheets on another origin', () => {
    const evil = 'WEBVTT\n\n00:00:00.000 --> 00:00:05.000\nhttps://evil.test/x.jpg#xywh=0,0,160,90\n';
    expect(parseSpriteVtt(evil, 'https://m.test/a/map.vtt')).toEqual([]);
  });
});

describe('findTile', () => {
  const tiles = parseSpriteVtt(VTT, 'https://m.test/m.vtt');
  it('finds the tile covering a time', () => {
    expect(findTile(tiles, 0)?.x).toBe(0);
    expect(findTile(tiles, 7.2)?.x).toBe(160);
    expect(findTile(tiles, 126)?.url).toContain('sheet-2');
  });
  it('uses the nearest earlier tile in a gap and the last tile past the end', () => {
    expect(findTile(tiles, 60)?.x).toBe(160);
    expect(findTile(tiles, 9999)?.url).toContain('sheet-2');
  });
  it('returns null with no tiles', () => {
    expect(findTile([], 3)).toBeNull();
  });
});

describe('SpriteLoader', () => {
  it('fetches nothing until asked, then once', async () => {
    const fetcher = vi.fn(async () => new Response(VTT));
    const loader = new SpriteLoader('https://m.test/m.vtt', fetcher as never);
    expect(fetcher).not.toHaveBeenCalled();
    await loader.load();
    await loader.load();
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(loader.tiles.length).toBe(3);
  });

  it('stays silent on failure and does not retry in a loop', async () => {
    const fetcher = vi.fn(async () => {
      throw new Error('offline');
    });
    const loader = new SpriteLoader('https://m.test/m.vtt', fetcher as never);
    await expect(loader.load()).resolves.toBeUndefined();
    await loader.load();
    expect(loader.tiles).toEqual([]);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('treats a non 200 answer as no sprite', async () => {
    const loader = new SpriteLoader('https://m.test/m.vtt', (async () => new Response('x', { status: 404 })) as never);
    await loader.load();
    expect(loader.tiles).toEqual([]);
  });
});
