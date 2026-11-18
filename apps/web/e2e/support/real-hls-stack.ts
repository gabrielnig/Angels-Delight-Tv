import { LocalStorage } from '@ad/storage';
import {
  PlaybackService,
  buildMasterTemplate,
  buildVariantTemplate,
  codecsFor,
  createPlaybackHandlers,
  encodeRungArgs,
  generateHlsKey,
  keyring,
  parseMediaPlaylist,
  secretRing,
  wrapHlsKey,
  type PlaybackStore,
  type PlannedRung,
} from '@ad/video';
import { RateLimited } from '@ad/shared';
import { build } from 'esbuild';
import { Miniflare } from 'miniflare';
import { spawnSync } from 'node:child_process';
import { createReadStream } from 'node:fs';
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { createServer, type IncomingMessage, type Server } from 'node:http';
import { createServer as createNetServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

/**
 * A real playback stack for one browser test, with no database and no mocks of our own code: ffmpeg encodes a
 * generated clip with the real AES-128 command line, the real PlaybackService signs the playlists, the real
 * handlers serve them with the real key route, and the real edge worker (src/index.ts in workerd) serves the
 * segments from an R2 bucket on another origin. The browser runs the real Player and hls.js.
 */

const HERE = import.meta.dirname;
const WEB = resolve(HERE, '../..');
const ROOT = resolve(WEB, '../..');

export interface StackOptions {
  /** Seconds a signed segment url stays valid. */
  segmentTtlSeconds?: number;
  /** Clip length in seconds. */
  clipSeconds?: number;
  /** Heights to encode. */
  heights?: number[];
  /** Add an audio track. */
  audio?: boolean;
}

export interface RecordedRequest {
  method: string;
  path: string;
  status: number;
  hasBearer: boolean;
  hasCookie: boolean;
}

export interface RealHlsStack {
  appUrl: string;
  edgeUrl: string;
  videoId: string;
  /** The raw 16 byte AES key, to prove segments are not plain MPEG-TS. */
  key: Uint8Array;
  requests: RecordedRequest[];
  /** Server clock offset in seconds: lets a test make every issued token expire without waiting. */
  clock: { offsetSeconds: number };
  state: { published: boolean };
  keyRequests(): number;
  segmentKeys(): Promise<string[]>;
  readSegment(key: string): Promise<Uint8Array>;
  stop(): Promise<void>;
}

function freePort(): Promise<number> {
  return new Promise((ok, fail) => {
    const s = createNetServer();
    s.once('error', fail);
    s.listen(0, '127.0.0.1', () => {
      const { port } = s.address() as { port: number };
      s.close(() => ok(port));
    });
  });
}

function run(cmd: string, args: string[]): void {
  const r = spawnSync(cmd, args, { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`${cmd} failed: ${r.stderr.slice(0, 600)}`);
}

/** A token bucket per policy and subject, enough to exercise the real key limits. */
function memoryLimiter() {
  const buckets = new Map<string, { tokens: number; at: number }>();
  return {
    async enforce(
      policy: { name: string; capacity: number; refillPerSecond: number },
      subject: string,
    ) {
      const now = Date.now() / 1000;
      const id = `${policy.name}:${subject}`;
      const b = buckets.get(id) ?? { tokens: policy.capacity, at: now };
      b.tokens = Math.min(policy.capacity, b.tokens + (now - b.at) * policy.refillPerSecond);
      b.at = now;
      if (b.tokens < 1) {
        buckets.set(id, b);
        throw new RateLimited(Math.ceil((1 - b.tokens) / policy.refillPerSecond));
      }
      b.tokens -= 1;
      buckets.set(id, b);
    },
  };
}

async function toWebRequest(req: IncomingMessage, base: string): Promise<Request> {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) if (v) headers.set(k, String(v));
  const body = chunks.length ? Buffer.concat(chunks) : undefined;
  return new Request(new URL(req.url ?? '/', base), {
    method: req.method ?? 'GET',
    headers,
    ...(body && req.method !== 'GET' && req.method !== 'HEAD' ? { body } : {}),
  });
}

export async function startRealHlsStack(options: StackOptions = {}): Promise<RealHlsStack> {
  const heights = options.heights ?? [360, 480];
  const work = await mkdtemp(join(tmpdir(), 'ad-real-hls-'));
  const videoId = '0194f1d2-7c3a-7b1e-8a55-3e2f9c1d4b60';
  const mediaPrefix = 'abcdef0123456789abcd';
  const secrets = {
    token: new Uint8Array(32).fill(21),
    media: new Uint8Array(32).fill(22),
    kek: new Uint8Array(32).fill(23),
  };

  // ---- encode with the real ffmpeg arguments ----
  const clip = join(work, 'clip.mp4');
  const seconds = options.clipSeconds ?? 60;
  const withAudio = options.audio ?? true;
  run('ffmpeg', [
    '-loglevel',
    'error',
    '-y',
    '-f',
    'lavfi',
    '-i',
    `testsrc2=size=640x360:rate=25:duration=${seconds}`,
    ...(withAudio ? ['-f', 'lavfi', '-i', `sine=frequency=440:duration=${seconds}`] : []),
    '-c:v',
    'libx264',
    '-preset',
    'ultrafast',
    '-pix_fmt',
    'yuv420p',
    '-g',
    '25',
    ...(withAudio ? ['-c:a', 'aac'] : ['-an']),
    clip,
  ]);

  const key = generateHlsKey();
  const keyPath = join(work, 'enc.key');
  await writeFile(keyPath, key);
  const keyInfoPath = join(work, 'keyinfo.txt');
  await writeFile(keyInfoPath, `enc.key\n${keyPath}\n`);

  const originals = new LocalStorage({
    root: join(work, 'store'),
    bucket: 'originals',
    signingSecret: secrets.media,
  });
  const segmentFiles = new Map<string, Uint8Array>();
  const master: Parameters<typeof buildMasterTemplate>[0] = [];
  for (const height of heights) {
    const rung: PlannedRung = {
      height,
      width: Math.round((height * 16) / 9 / 2) * 2,
      videoKbps: height === 360 ? 500 : 900,
      audioKbps: 96,
      profile: 'main',
    };
    const outDir = join(work, `out-${height}`);
    await mkdir(outDir, { recursive: true });
    run(
      'ffmpeg',
      encodeRungArgs({
        input: clip,
        container: 'mp4',
        outDir,
        rung,
        hasAudio: withAudio,
        keyInfoPath,
        preset: 'ultrafast',
        threads: 0,
      }).filter((a) => a !== '-progress' && a !== 'pipe:1' && a !== '-nostats'),
    );
    const playlist = parseMediaPlaylist(await readFile(join(outDir, 'index.m3u8'), 'utf8'));
    await originals.put(
      `templates/${videoId}/${height}.m3u8`,
      new TextEncoder().encode(buildVariantTemplate({ videoId, segments: playlist.segments })),
      {},
    );
    for (const name of (await readdir(outDir)).filter((f) => f.endsWith('.ts'))) {
      segmentFiles.set(`v/${mediaPrefix}/${height}/${name}`, await readFile(join(outDir, name)));
    }
    master.push({
      height,
      width: rung.width,
      bandwidthBps: (rung.videoKbps + rung.audioKbps) * 1000,
      avgBandwidthBps: (rung.videoKbps + rung.audioKbps) * 900,
      codecs: codecsFor(rung, withAudio),
    });
  }
  await originals.put(
    `templates/${videoId}/master.m3u8`,
    new TextEncoder().encode(buildMasterTemplate(master)),
    {},
  );

  // ---- the real edge worker in workerd, on its own origin ----
  const appPort = await freePort();
  const edgePort = await freePort();
  const appUrl = `http://127.0.0.1:${appPort}`;
  const edgeUrl = `http://127.0.0.1:${edgePort}`;
  const bundled = await build({
    entryPoints: [join(ROOT, 'apps/edge/src/index.ts')],
    bundle: true,
    write: false,
    format: 'esm',
    platform: 'neutral',
    target: 'es2022',
  });
  const mf = new Miniflare({
    modules: true,
    script: bundled.outputFiles[0]!.text,
    compatibilityDate: '2025-01-01',
    r2Buckets: ['MEDIA'],
    host: '127.0.0.1',
    port: edgePort,
    bindings: {
      MEDIA_URL_SECRET: Buffer.from(secrets.media).toString('base64'),
      APP_ORIGIN: appUrl,
    },
  });
  await mf.ready;
  const bucket = (await mf.getR2Bucket('MEDIA')) as unknown as {
    put(k: string, v: Uint8Array): Promise<unknown>;
  };
  for (const [k, v] of segmentFiles) await bucket.put(k, v);

  // ---- the real playback service and handlers ----
  const state = { published: true };
  const clock = { offsetSeconds: 0 };
  const now = () => Date.now() / 1000 + clock.offsetSeconds;
  const store: PlaybackStore = {
    video: async (id) =>
      id === videoId
        ? {
            id,
            mediaPrefix,
            status: 'ready',
            publishState: state.published ? 'published' : 'draft',
            publishAt: null,
            kidsSafe: true,
            deletedAt: null,
          }
        : null,
    profile: async (id) => ({ id, isKids: false }),
    wrappedKey: async () => wrapHlsKey(keyring(secrets.kek), videoId, key).keyWrapped,
    captions: async () => [],
    spriteKey: async () => null,
  };
  const service = new PlaybackService({
    store,
    originals,
    tokens: secretRing(secrets.token),
    mediaSecret: secrets.media,
    keyring: keyring(secrets.kek),
    limiter: memoryLimiter(),
    appOrigin: appUrl,
    mediaOrigin: edgeUrl,
    segmentTtlSeconds: options.segmentTtlSeconds ?? 2 * 3600,
    now,
  });
  const handlers = createPlaybackHandlers({
    service,
    getViewer: async () => ({ accountId: 'acc-1', profileId: 'prof-1' }),
    getActor: async () => ({ accountId: 'acc-1', role: 'admin' }),
    clientIp: () => '127.0.0.1',
    onUnexpected: (error) => console.error('stack: unexpected', error),
  });

  // ---- the player bundle ----
  const js = await build({
    entryPoints: [join(HERE, 'hls-player-entry.tsx')],
    bundle: true,
    write: false,
    format: 'iife',
    jsx: 'automatic',
    target: 'es2022',
    define: { 'process.env.NODE_ENV': '"production"' },
    absWorkingDir: WEB,
  });
  const playerJs = js.outputFiles[0]!.text;
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>real hls</title>
<link rel="stylesheet" href="/tokens.css"><link rel="stylesheet" href="/player.css"></head>
<body style="margin:0;background:#fff"><div id="root" style="max-width:900px"></div>
<script>window.__HLS_CFG=${JSON.stringify({ videoId, profileId: 'prof-1', appOrigin: appUrl })}</script>
<script src="/player.js"></script></body></html>`;

  const requests: RecordedRequest[] = [];
  const app: Server = createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', appUrl);
    const send = async (r: Response) => {
      res.writeHead(r.status, Object.fromEntries(r.headers));
      res.end(Buffer.from(await r.arrayBuffer()));
    };
    try {
      if (url.pathname === '/')
        return void (res.writeHead(200, { 'content-type': 'text/html' }), res.end(html));
      if (url.pathname === '/player.js')
        return void (res.writeHead(200, { 'content-type': 'text/javascript' }), res.end(playerJs));
      if (url.pathname === '/tokens.css' || url.pathname === '/player.css') {
        const file =
          url.pathname === '/tokens.css'
            ? 'packages/ui/src/tokens.css'
            : 'packages/player/src/player.css';
        res.writeHead(200, { 'content-type': 'text/css' });
        return void createReadStream(join(ROOT, file)).pipe(res);
      }
      const web = await toWebRequest(req, appUrl);
      let response: Response | null = null;
      let m: RegExpExecArray | null;
      if ((m = /^\/api\/play\/([^/]+)\/session$/.exec(url.pathname)) && req.method === 'POST')
        response = await handlers.session(web, m[1]!);
      else if ((m = /^\/api\/play\/([^/]+)\/master\.m3u8$/.exec(url.pathname)))
        response = await handlers.master(web, m[1]!);
      else if ((m = /^\/api\/play\/([^/]+)\/(\d{3,4})\.m3u8$/.exec(url.pathname)))
        response = await handlers.variant(web, m[1]!, m[2]!);
      else if ((m = /^\/api\/hls\/keys\/([^/]+)$/.exec(url.pathname)))
        response = await handlers.key(web, m[1]!);
      if (!response) return void (res.writeHead(404), res.end('not found'));
      requests.push({
        method: req.method ?? 'GET',
        path: url.pathname,
        status: response.status,
        hasBearer: /^Bearer /.test(req.headers.authorization ?? ''),
        hasCookie: Boolean(req.headers.cookie),
      });
      await send(response);
    } catch (error) {
      res.writeHead(500);
      res.end(String(error));
    }
  });
  await new Promise<void>((ok) => app.listen(appPort, '127.0.0.1', ok));

  return {
    appUrl,
    edgeUrl,
    videoId,
    key,
    requests,
    clock,
    state,
    keyRequests: () => requests.filter((r) => r.path.startsWith('/api/hls/keys/')).length,
    segmentKeys: async () => [...segmentFiles.keys()],
    readSegment: async (k) => segmentFiles.get(k) ?? new Uint8Array(),
    async stop() {
      await new Promise<void>((ok) => app.close(() => ok()));
      await mf.dispose();
      await rm(work, { recursive: true, force: true });
    },
  };
}
