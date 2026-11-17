import { describe, expect, it } from 'vitest';
import {
  ProgressParser,
  demuxerFor,
  encodeRungArgs,
  extractAudioArgs,
  ffprobeArgs,
  segmentBandwidths,
  thumbnailArgs,
} from './ffmpeg';

const rung = {
  height: 720,
  width: 1280,
  videoKbps: 1800,
  audioKbps: 128,
  profile: 'high' as const,
};
const base = {
  input: '/scratch/job/source.mp4',
  container: 'mp4' as const,
  outDir: '/scratch/job/720',
  rung,
  hasAudio: true,
  keyInfoPath: '/scratch/job/keyinfo.txt',
  preset: 'veryfast',
  threads: 0,
};

const pair = (args: string[], flag: string) => args[args.indexOf(flag) + 1];

describe('demuxerFor', () => {
  it('forces the demuxer family that matches the sniffed bytes', () => {
    expect(demuxerFor('mp4')).toBe('mov,mp4,m4a,3gp,3g2,mj2');
    expect(demuxerFor('mov')).toBe('mov,mp4,m4a,3gp,3g2,mj2');
    expect(demuxerFor('webm')).toBe('matroska,webm');
    expect(demuxerFor('matroska')).toBe('matroska,webm');
  });
});

describe('ffprobeArgs', () => {
  it('uses an argument array with the file-only protocol whitelist and a forced demuxer', () => {
    const args = ffprobeArgs('/x/source.mkv', 'matroska');
    expect(args).toEqual(
      expect.arrayContaining(['-protocol_whitelist', 'file', '-f', 'matroska,webm']),
    );
    expect(args.at(-1)).toBe('/x/source.mkv');
    expect(args.indexOf('-protocol_whitelist')).toBeLessThan(args.indexOf('/x/source.mkv'));
    expect(args).toEqual(
      expect.arrayContaining(['-print_format', 'json', '-show_format', '-show_streams']),
    );
  });
});

describe('encodeRungArgs', () => {
  const args = encodeRungArgs(base);

  it('puts input safety flags before the input and never uses a shell string', () => {
    expect(args.every((arg) => typeof arg === 'string')).toBe(true);
    const input = args.indexOf('-i');
    expect(args.indexOf('-protocol_whitelist')).toBeLessThan(input);
    expect(args.indexOf('-f')).toBeLessThan(input);
    expect(args[input + 1]).toBe(base.input);
    expect(args).toContain('-nostdin');
  });

  it('encodes H.264 at the rung size with capped bitrate and aligned 6 second keyframes', () => {
    expect(pair(args, '-c:v')).toBe('libx264');
    expect(pair(args, '-preset')).toBe('veryfast');
    expect(pair(args, '-profile:v')).toBe('high');
    expect(pair(args, '-level:v')).toBe('3.1');
    expect(pair(args, '-vf')).toBe('scale=1280:720,setsar=1');
    expect(pair(args, '-maxrate')).toBe('1800k');
    expect(pair(args, '-bufsize')).toBe('3600k');
    expect(pair(args, '-crf')).toBe('23');
    expect(pair(args, '-sc_threshold')).toBe('0');
    expect(pair(args, '-force_key_frames')).toBe('expr:gte(t,n_forced*6)');
    expect(pair(args, '-pix_fmt')).toBe('yuv420p');
  });

  it('encodes stereo AAC with loudness normalisation when there is audio', () => {
    expect(pair(args, '-c:a')).toBe('aac');
    expect(pair(args, '-b:a')).toBe('128k');
    expect(pair(args, '-ac')).toBe('2');
    expect(pair(args, '-af')).toMatch(/^loudnorm=I=-16/);
  });

  it('writes encrypted 6 second MPEG-TS VOD segments with the key info file', () => {
    expect(pair(args, '-f')).toBe('mov,mp4,m4a,3gp,3g2,mj2');
    expect(args).toEqual(
      expect.arrayContaining([
        '-hls_time',
        '6',
        '-hls_playlist_type',
        'vod',
        '-hls_segment_type',
        'mpegts',
      ]),
    );
    expect(pair(args, '-hls_key_info_file')).toBe(base.keyInfoPath);
    expect(pair(args, '-hls_segment_filename')).toBe('/scratch/job/720/seg_%05d.ts');
    expect(args.at(-1)).toBe('/scratch/job/720/index.m3u8');
    expect(pair(args, '-start_number')).toBe('0');
  });

  it('reports progress on stdout and strips source metadata', () => {
    expect(args).toEqual(expect.arrayContaining(['-progress', 'pipe:1', '-nostats']));
    expect(pair(args, '-map_metadata')).toBe('-1');
  });

  it('omits audio options for a silent source', () => {
    const silent = encodeRungArgs({ ...base, hasAudio: false });
    expect(silent).toContain('-an');
    expect(silent).not.toContain('-c:a');
    expect(silent).not.toContain('-af');
  });

  it('adds a thread count only when configured', () => {
    expect(args).not.toContain('-threads');
    expect(pair(encodeRungArgs({ ...base, threads: 2 }), '-threads')).toBe('2');
  });

  it('uses the main profile and level 3.0 for low rungs', () => {
    const low = encodeRungArgs({
      ...base,
      rung: { height: 360, width: 640, videoKbps: 500, audioKbps: 96, profile: 'main' },
    });
    expect(pair(low, '-profile:v')).toBe('main');
    expect(pair(low, '-level:v')).toBe('3.0');
  });
});

describe('thumbnailArgs and extractAudioArgs', () => {
  it('seeks before the input and writes a single scaled webp frame', () => {
    const args = thumbnailArgs({
      input: '/s/source.mp4',
      container: 'mp4',
      atSeconds: 7.5,
      width: 640,
      output: '/s/t1.webp',
    });
    expect(args.indexOf('-ss')).toBeLessThan(args.indexOf('-i'));
    expect(pair(args, '-ss')).toBe('7.500');
    expect(pair(args, '-frames:v')).toBe('1');
    expect(pair(args, '-vf')).toBe('scale=640:-2');
    expect(args.at(-1)).toBe('/s/t1.webp');
  });
  it('extracts mono 16 kHz audio for speech recognition', () => {
    const args = extractAudioArgs({
      input: '/s/source.mp4',
      container: 'mp4',
      output: '/s/audio.wav',
    });
    expect(args).toEqual(expect.arrayContaining(['-vn', '-ac', '1', '-ar', '16000']));
    expect(args.at(-1)).toBe('/s/audio.wav');
  });
});

describe('ProgressParser', () => {
  it('reads out_time from ffmpeg progress blocks, including split chunks', () => {
    const parser = new ProgressParser();
    expect(parser.feed('frame=10\nout_time_us=1500000\nprog')).toBe(1500);
    expect(parser.feed('ress=continue\nout_time_us=3000000\n')).toBe(3000);
    expect(parser.feed('progress=end\n')).toBeNull();
  });
  it('ignores N/A values', () => {
    expect(new ProgressParser().feed('out_time_us=N/A\n')).toBeNull();
  });
});

describe('segmentBandwidths', () => {
  it('returns peak and average bits per second from segment sizes and durations', () => {
    const result = segmentBandwidths([
      { bytes: 75_000, seconds: 6 },
      { bytes: 150_000, seconds: 6 },
      { bytes: 25_000, seconds: 2 },
    ]);
    expect(result.peak).toBe(200_000);
    expect(result.average).toBe(Math.round((250_000 * 8) / 14));
  });
});
