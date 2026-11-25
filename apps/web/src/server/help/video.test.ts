import { Readable } from 'node:stream';
import { describe, expect, it } from 'vitest';
import { parseRange, parseVtt, resolveVideoSource, serveVideo, videoFileType } from './video';

describe('videoFileType (M50-S07)', () => {
  it('allows only the files a help video has', () => {
    expect(videoFileType('VD02', 'VD02-720.mp4')).toBe('video/mp4');
    expect(videoFileType('VD02', 'VD02-480.mp4')).toBe('video/mp4');
    expect(videoFileType('VD02', 'VD02-phone-720.mp4')).toBe('video/mp4');
    expect(videoFileType('VD02', 'VD02-poster.webp')).toBe('image/webp');
    expect(videoFileType('VD02', 'VD02-captions.vtt')).toBe('text/vtt; charset=utf-8');
  });
  it('refuses another video id, a bad id, other names and path tricks', () => {
    for (const [id, name] of [
      ['VD02', 'VD03-720.mp4'],
      ['D02', 'D02-720.mp4'],
      ['VD02', 'VD02-720.exe'],
      ['VD02', '../VD02-720.mp4'],
      ['VD02', 'VD02-1080.mp4'],
    ] as const) {
      expect(videoFileType(id, name), `${id} ${name}`).toBeNull();
    }
  });
});

describe('resolveVideoSource', () => {
  it('uses the placeholder files for the sample release and storage keys for a real release', () => {
    expect(resolveVideoSource('sample', 'VD02', 'VD02-720.mp4')).toEqual({
      kind: 'placeholder',
      name: 'placeholder-720.mp4',
    });
    expect(resolveVideoSource('sample', 'VD02', 'VD02-phone-720.mp4')).toEqual({
      kind: 'placeholder',
      name: 'placeholder-720.mp4',
    });
    expect(resolveVideoSource('v1.0.0', 'VD02', 'VD02-720.mp4')).toEqual({
      kind: 'storage',
      key: 'help/v1.0.0/VD02/VD02-720.mp4',
    });
  });
  it('refuses a release name that is not a plain tag', () => {
    expect(() => resolveVideoSource('../x', 'VD02', 'VD02-720.mp4')).toThrow(/release/i);
  });
});

describe('parseRange', () => {
  it('reads start and end, open ended and suffix ranges', () => {
    expect(parseRange('bytes=0-99', 1000)).toEqual({ start: 0, end: 99 });
    expect(parseRange('bytes=900-', 1000)).toEqual({ start: 900, end: 999 });
    expect(parseRange('bytes=-100', 1000)).toEqual({ start: 900, end: 999 });
    expect(parseRange('bytes=0-5000', 1000)).toEqual({ start: 0, end: 999 });
  });
  it('says none for no header, and unsatisfiable for a start past the end or nonsense', () => {
    expect(parseRange(null, 1000)).toBeNull();
    expect(parseRange('bytes=2000-', 1000)).toBe('unsatisfiable');
    expect(parseRange('bytes=5-2', 1000)).toBe('unsatisfiable');
    expect(parseRange('items=0-1', 1000)).toBeNull();
  });
});

describe('serveVideo', () => {
  const source = {
    size: 10,
    open: (start: number, end: number) =>
      Readable.from([Buffer.from('0123456789').subarray(start, end + 1)]),
  };
  const headers = { 'x-test': '1' };
  it('serves a whole file with range support advertised and private caching', async () => {
    const res = serveVideo(source, 'video/mp4', null, headers);
    expect(res.status).toBe(200);
    expect(res.headers.get('accept-ranges')).toBe('bytes');
    expect(res.headers.get('content-length')).toBe('10');
    expect(res.headers.get('cache-control')).toMatch(/private/);
    expect(await res.text()).toBe('0123456789');
  });
  it('serves a range with 206 and a content range', async () => {
    const res = serveVideo(source, 'video/mp4', 'bytes=2-4', headers);
    expect(res.status).toBe(206);
    expect(res.headers.get('content-range')).toBe('bytes 2-4/10');
    expect(await res.text()).toBe('234');
  });
  it('answers 416 for a range past the end', () => {
    const res = serveVideo(source, 'video/mp4', 'bytes=50-', headers);
    expect(res.status).toBe(416);
    expect(res.headers.get('content-range')).toBe('bytes */10');
  });
});

describe('parseVtt', () => {
  it('lists the cues with start seconds and text', () => {
    const cues = parseVtt(
      'WEBVTT\n\n00:00:00.500 --> 00:00:03.000\nFirst line.\n\n00:01:05.250 --> 00:01:08.000\nSecond\nline.\n',
    );
    expect(cues).toEqual([
      { start: 0.5, end: 3, text: 'First line.' },
      { start: 65.25, end: 68, text: 'Second line.' },
    ]);
  });
});
