import { describe, expect, it } from 'vitest';
import { parseFfprobe, validateProbe, type ProbeLimits } from './probe';

const limits: ProbeLimits = { maxSeconds: 1800, warnSeconds: 3600 };

function raw(overrides: Record<string, unknown> = {}) {
  return {
    format: { format_name: 'mov,mp4,m4a,3gp,3g2,mj2', duration: '20.000000', bit_rate: '900000' },
    streams: [
      {
        codec_type: 'video',
        codec_name: 'h264',
        width: 1280,
        height: 720,
        avg_frame_rate: '30/1',
        r_frame_rate: '30/1',
      },
      { codec_type: 'audio', codec_name: 'aac', channels: 2, sample_rate: '48000' },
    ],
    ...overrides,
  };
}

describe('parseFfprobe', () => {
  it('extracts duration, size, frame rate, codecs and audio presence', () => {
    expect(parseFfprobe(raw())).toEqual({
      formatName: 'mov,mp4,m4a,3gp,3g2,mj2',
      durationMs: 20000,
      width: 1280,
      height: 720,
      frameRate: 30,
      videoCodec: 'h264',
      audioCodec: 'aac',
      hasAudio: true,
      streamCount: 2,
    });
  });
  it('flags a source without audio', () => {
    const probe = parseFfprobe(raw({ streams: [raw().streams[0]] }));
    expect(probe.hasAudio).toBe(false);
    expect(probe.audioCodec).toBeNull();
  });
  it('applies the display rotation so portrait phone clips are portrait', () => {
    const stream = {
      ...(raw().streams[0] as object),
      width: 1920,
      height: 1080,
      side_data_list: [{ rotation: -90 }],
    };
    const probe = parseFfprobe(raw({ streams: [stream] }));
    expect([probe.width, probe.height]).toEqual([1080, 1920]);
  });
  it('throws a readable error for non-objects', () => {
    expect(() => parseFfprobe(null)).toThrow(/ffprobe/i);
  });
});

describe('validateProbe', () => {
  it('accepts a normal clip', () => {
    expect(validateProbe(parseFfprobe(raw()), 'mp4', limits)).toEqual({ ok: true, warnings: [] });
  });
  it('rejects a file with no video stream', () => {
    const result = validateProbe(parseFfprobe(raw({ streams: [raw().streams[1]] })), 'mp4', limits);
    expect(result).toMatchObject({ ok: false, code: 'no_video_stream' });
  });
  it('rejects zero duration and unreadable duration', () => {
    const zero = raw({ format: { format_name: 'mov,mp4', duration: '0' } });
    expect(validateProbe(parseFfprobe(zero), 'mp4', limits)).toMatchObject({
      ok: false,
      code: 'unreadable_file',
    });
  });
  it('rejects a video over the limit and warns above the soft limit', () => {
    const long = raw({ format: { format_name: 'mov,mp4', duration: '2000' } });
    expect(validateProbe(parseFfprobe(long), 'mp4', limits)).toMatchObject({
      ok: false,
      code: 'too_long',
    });
    const warn = validateProbe(parseFfprobe(long), 'mp4', { maxSeconds: 7200, warnSeconds: 1800 });
    expect(warn).toMatchObject({ ok: true });
    expect(warn.ok && warn.warnings[0]).toMatch(/short videos/i);
  });
  it('rejects a container that does not match what the bytes said', () => {
    const mkv = raw({ format: { format_name: 'matroska,webm', duration: '10' } });
    expect(validateProbe(parseFfprobe(mkv), 'mp4', limits)).toMatchObject({
      ok: false,
      code: 'unsupported_format',
    });
    expect(validateProbe(parseFfprobe(mkv), 'webm', limits)).toMatchObject({ ok: true });
  });
  it('rejects an HLS playlist or image disguised by name', () => {
    const hls = raw({ format: { format_name: 'hls', duration: '10' } });
    expect(validateProbe(parseFfprobe(hls), 'mp4', limits)).toMatchObject({
      ok: false,
      code: 'unsupported_format',
    });
  });
  it('rejects silly dimensions and too many streams', () => {
    const tiny = { ...(raw().streams[0] as object), width: 32, height: 32 };
    expect(validateProbe(parseFfprobe(raw({ streams: [tiny] })), 'mp4', limits)).toMatchObject({
      ok: false,
      code: 'bad_dimensions',
    });
    const many = raw({
      streams: Array.from({ length: 40 }, () => ({ codec_type: 'data' })).concat(
        raw().streams as never[],
      ),
    });
    expect(validateProbe(parseFfprobe(many), 'mp4', limits)).toMatchObject({
      ok: false,
      code: 'unreadable_file',
    });
  });
});
