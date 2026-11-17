import { describe, expect, it } from 'vitest';
import {
  buildMasterTemplate,
  buildVariantTemplate,
  parseMediaPlaylist,
  rewriteMaster,
  rewriteVariant,
} from './playlist';

const videoId = '0192f0a0-0000-7000-8000-000000000001';

const ffmpegPlaylist = `#EXTM3U
#EXT-X-VERSION:3
#EXT-X-TARGETDURATION:6
#EXT-X-MEDIA-SEQUENCE:0
#EXT-X-PLAYLIST-TYPE:VOD
#EXT-X-KEY:METHOD=AES-128,URI="enc.key"
#EXTINF:6.000000,
seg_00000.ts
#EXTINF:6.000000,
seg_00001.ts
#EXTINF:2.500000,
seg_00002.ts
#EXT-X-ENDLIST
`;

describe('parseMediaPlaylist', () => {
  it('reads segment names and durations from ffmpeg output', () => {
    const parsed = parseMediaPlaylist(ffmpegPlaylist);
    expect(parsed.segments).toEqual([
      { name: 'seg_00000.ts', seconds: 6 },
      { name: 'seg_00001.ts', seconds: 6 },
      { name: 'seg_00002.ts', seconds: 2.5 },
    ]);
  });
  it('rejects playlists with no segments or with absolute urls', () => {
    expect(() => parseMediaPlaylist('#EXTM3U\n#EXT-X-ENDLIST\n')).toThrow(/segment/i);
    expect(() => parseMediaPlaylist('#EXTM3U\n#EXTINF:6,\nhttp://evil/x.ts\n')).toThrow(/segment/i);
  });
});

describe('variant template and rewrite', () => {
  const segments = parseMediaPlaylist(ffmpegPlaylist).segments;
  const template = buildVariantTemplate({ videoId, segments });

  it('references the key through the ad-key scheme and segments relatively', () => {
    expect(template).toContain(`#EXT-X-KEY:METHOD=AES-128,URI="ad-key://${videoId}"`);
    expect(template).toContain('#EXT-X-TARGETDURATION:6');
    expect(template).toContain('#EXT-X-ENDLIST');
    expect(template).not.toContain('enc.key');
    expect(template).toMatch(/\nseg_00001\.ts\n/);
  });

  it('rewrites segments through the signer and the key to the app origin', () => {
    const out = rewriteVariant(template, {
      videoId,
      appOrigin: 'https://app.example.com',
      segmentUrl: (name) => `https://media.example.com/v/p/720/${name}?exp=1&sig=s`,
    });
    expect(out).toContain(`URI="https://app.example.com/api/hls/keys/${videoId}"`);
    expect(out).toContain('https://media.example.com/v/p/720/seg_00002.ts?exp=1&sig=s');
    expect(out).not.toContain('ad-key://');
  });

  it('adds the pt token to the key uri for native HLS clients', () => {
    const out = rewriteVariant(template, {
      videoId,
      appOrigin: 'https://app.example.com',
      segmentUrl: (name) => name,
      keyQuery: 'pt=abc',
    });
    expect(out).toContain(`/api/hls/keys/${videoId}?pt=abc"`);
  });

  it('refuses a template that carries an unexpected uri', () => {
    const bad = template.replace('seg_00000.ts', 'https://evil.example/x.ts');
    expect(() =>
      rewriteVariant(bad, { videoId, appOrigin: 'https://a', segmentUrl: (n) => n }),
    ).toThrow(/template/i);
    const wrongKey = template.replace(`ad-key://${videoId}`, 'ad-key://someone-else');
    expect(() =>
      rewriteVariant(wrongKey, { videoId, appOrigin: 'https://a', segmentUrl: (n) => n }),
    ).toThrow(/template/i);
  });
});

describe('master template and rewrite', () => {
  const master = buildMasterTemplate([
    {
      height: 360,
      width: 640,
      bandwidthBps: 700_000,
      avgBandwidthBps: 600_000,
      codecs: 'avc1.4d001e,mp4a.40.2',
    },
    {
      height: 720,
      width: 1280,
      bandwidthBps: 2_400_000,
      avgBandwidthBps: 2_000_000,
      codecs: 'avc1.64001f,mp4a.40.2',
    },
  ]);

  it('lists variants from lowest to highest with bandwidth, resolution and codecs', () => {
    expect(master.startsWith('#EXTM3U\n#EXT-X-VERSION:3\n')).toBe(true);
    expect(master).toContain(
      '#EXT-X-STREAM-INF:BANDWIDTH=700000,AVERAGE-BANDWIDTH=600000,RESOLUTION=640x360,CODECS="avc1.4d001e,mp4a.40.2"\n360.m3u8',
    );
    expect(master.indexOf('360.m3u8')).toBeLessThan(master.indexOf('720.m3u8'));
  });

  it('points variants at the play route and carries the pt token on native clients', () => {
    const out = rewriteMaster(master, { videoId, appOrigin: 'https://app.example.com' });
    expect(out).toContain(`https://app.example.com/api/play/${videoId}/360.m3u8\n`);
    const native = rewriteMaster(master, {
      videoId,
      appOrigin: 'https://app.example.com',
      query: 'pt=abc',
    });
    expect(native).toContain(`/api/play/${videoId}/720.m3u8?pt=abc\n`);
  });

  it('refuses an empty ladder', () => {
    expect(() => buildMasterTemplate([])).toThrow();
  });
});
