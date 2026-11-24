import { schema } from '@ad/db';
import { DrizzleJobMirror, JobProducer, ensureQueues } from '@ad/queue';
import { FakeBoss } from '@ad/queue/testing';
import { Forbidden, Unauthorized, uuidv7, type Actor } from '@ad/shared';
import { LocalStorage } from '@ad/storage';
import {
  CaptionService,
  DrizzlePlaybackStore,
  PlaybackService,
  UploadService,
  buildMasterTemplate,
  buildVariantTemplate,
  createDevMediaHandler,
  createDevStorageHandler,
  generateHlsKey,
  keyring,
  secretRing,
  wrapHlsKey,
} from '@ad/video';
import {
  createHarness,
  integrationEnabled,
  seedVideo,
  type ViewerHarness,
} from '@ad/viewer/testing';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { guestCookieName, guestSetCookie, signGuest } from '../guest/guest-cookie';
import { resolveGuest } from '../guest/resolve-guest';
import { createVideoApi, type VideoApi } from './api';

const ORIGIN = 'https://app.test';
const MIB = 1024 * 1024;
const secret = new Uint8Array(32).fill(3);
const hlsKek = new Uint8Array(32).fill(8);
const guestSecret = new Uint8Array(32).fill(6);

describe.skipIf(!integrationEnabled())('video api routes', () => {
  let h: ViewerHarness;
  let api: VideoApi;
  let root: string;
  let originals: LocalStorage;
  let media: LocalStorage;
  let boss: FakeBoss;
  let editor: Actor;
  let viewer: Awaited<ReturnType<ViewerHarness['makeUser']>>;
  let current: { kind: 'none' } | { kind: 'staff'; actor: Actor } | { kind: 'viewer' } = {
    kind: 'none',
  };
  let limited = 0;
  let guestPlay = false;
  let guestKids = false;
  let key16: Uint8Array;
  let video: Awaited<ReturnType<typeof seedVideo>>;

  const req = (path: string, init: RequestInit = {}) => {
    const headers = new Headers(init.headers);
    if (init.method && init.method !== 'GET' && !headers.has('origin'))
      headers.set('origin', ORIGIN);
    return new Request(`${ORIGIN}${path}`, { ...init, headers });
  };
  const post = (path: string, body: unknown = {}, headers: HeadersInit = {}) =>
    req(path, { method: 'POST', body: JSON.stringify(body), headers });

  beforeAll(async () => {
    h = await createHarness();
    root = await mkdtemp(join(tmpdir(), 'ad-k2-'));
    originals = new LocalStorage({ root, bucket: 'originals', signingSecret: secret });
    media = new LocalStorage({ root, bucket: 'media', signingSecret: secret });
    boss = new FakeBoss();
    await ensureQueues(boss);
    const producer = new JobProducer({ boss, mirror: new DrizzleJobMirror(h.db.app) });
    editor = (await h.makeUser('editor')).actor;
    viewer = await h.makeUser();

    video = await seedVideo(h.db.setup, { kidsSafe: true, title: 'Rivers' });
    key16 = generateHlsKey();
    await h.db.setup
      .insert(schema.videoKeys)
      .values({ videoId: video.id, ...wrapHlsKey(keyring(hlsKek), video.id, key16) })
      // seedVideo already stored a placeholder key for the publish check.
      .onConflictDoUpdate({
        target: schema.videoKeys.videoId,
        set: { ...wrapHlsKey(keyring(hlsKek), video.id, key16) },
      });
    await originals.put(
      `templates/${video.id}/master.m3u8`,
      new TextEncoder().encode(
        buildMasterTemplate([
          {
            height: 360,
            width: 640,
            bandwidthBps: 800000,
            avgBandwidthBps: 700000,
            codecs: 'avc1.4d401e,mp4a.40.2',
          },
        ]),
      ),
    );
    await originals.put(
      `templates/${video.id}/360.m3u8`,
      new TextEncoder().encode(
        buildVariantTemplate({
          videoId: video.id,
          segments: [{ name: 'seg_00000.ts', seconds: 6 }],
        }),
      ),
    );

    const playback = new PlaybackService({
      store: new DrizzlePlaybackStore(h.db.app),
      originals,
      tokens: secretRing(secret),
      mediaSecret: secret,
      keyring: keyring(hlsKek),
      limiter: {
        enforce: async () => {
          if (limited > 0) {
            limited -= 1;
            const { RateLimited } = await import('@ad/shared');
            throw new RateLimited(17);
          }
          return {};
        },
      },
      appOrigin: ORIGIN,
      mediaOrigin: `${ORIGIN}/api/dev-media`,
    });
    api = createVideoApi({
      db: h.db.app,
      auth: {
        getActor: async () => {
          if (current.kind === 'none') throw new Unauthorized();
          if (current.kind === 'viewer') throw new Forbidden();
          return current.actor;
        },
        getViewer: async () => {
          if (current.kind === 'none') throw new Unauthorized();
          return { accountId: viewer.accountId, profileId: viewer.profileId };
        },
      },
      upload: new UploadService({
        db: h.db.app,
        originals,
        media,
        producer,
        limits: { maxBytes: 5 * 1024 * MIB, partBytes: 5 * MIB },
      }),
      playback,
      captions: new CaptionService({ db: h.db.app, originals, media, producer }),
      publishing: { db: h.db.app },
      guest: {
        playEnabled: async () => guestPlay,
        getGuest: async (request, { mint }) => {
          const r = resolveGuest(request, { secret: guestSecret, secure: true, mint });
          if (!r) return null;
          return {
            guestId: r.guestId,
            kids: guestKids,
            ...(r.isNew ? { setCookie: guestSetCookie(guestSecret, true, r.guestId) } : {}),
          };
        },
      },
      appOrigin: ORIGIN,
      trustedProxyMode: 'none',
      devStorage: createDevStorageHandler({
        nodeEnv: 'test',
        secret,
        buckets: { originals, media },
      }),
      devMedia: createDevMediaHandler({ nodeEnv: 'test', mediaSecret: secret, media }),
    });
  });
  afterAll(async () => {
    await h?.drop();
    if (root) await rm(root, { recursive: true, force: true });
  });

  describe('admin upload', () => {
    const file = {
      name: 'Lesson.mp4',
      size: 6 * MIB,
      type: 'video/mp4',
      fingerprint: 'fingerprint-one-abcdef',
    };

    it('answers 401 when signed out and 403 for a viewer', async () => {
      current = { kind: 'none' };
      expect((await api.upload.create(post('/api/admin/uploads', file))).status).toBe(401);
      current = { kind: 'viewer' };
      expect((await api.upload.create(post('/api/admin/uploads', file))).status).toBe(403);
    });

    it('refuses a cross-origin write before checking who is signed in', async () => {
      current = { kind: 'staff', actor: editor };
      const res = await api.upload.create(
        post('/api/admin/uploads', file, { origin: 'https://evil.test' }),
      );
      expect(res.status).toBe(403);
    });

    it('creates, uploads parts through the dev storage route, completes and queues the probe', async () => {
      current = { kind: 'staff', actor: editor };
      const created = await api.upload.create(post('/api/admin/uploads', file));
      expect(created.status).toBe(201);
      const state = await created.json();
      expect(state).toMatchObject({ resumed: false, totalParts: 2, uploadedParts: [] });

      const urls = (
        await (
          await api.upload.parts(
            post(`/api/admin/uploads/${state.uploadId}/parts`, { partNumbers: [1, 2] }),
            state.uploadId,
          )
        ).json()
      ).urls as Record<string, string>;
      const sizes = [5 * MIB, MIB];
      for (const [index, n] of [1, 2].entries()) {
        const put = await api.devStorage(
          new Request(new URL(urls[String(n)]!, ORIGIN), {
            method: 'PUT',
            body: new Uint8Array(sizes[index]!),
          }),
        );
        expect(put.status, `part ${n}`).toBe(200);
      }

      const described = await (
        await api.upload.describe(req(`/api/admin/uploads/${state.uploadId}`), state.uploadId)
      ).json();
      expect(described.uploadedParts).toEqual([1, 2]);

      const done = await api.upload.complete(
        post(`/api/admin/uploads/${state.uploadId}/complete`),
        state.uploadId,
      );
      expect(done.status).toBe(200);
      expect(
        boss.jobs.some((j) => j.name === 'video.probe' && j.data.videoId === state.videoId),
      ).toBe(true);
    });

    it('lists missing parts with 409 on an incomplete upload, and aborts', async () => {
      current = { kind: 'staff', actor: editor };
      const state = await (
        await api.upload.create(
          post('/api/admin/uploads', { ...file, fingerprint: 'fingerprint-two-abcdef' }),
        )
      ).json();
      const res = await api.upload.complete(
        post(`/api/admin/uploads/${state.uploadId}/complete`),
        state.uploadId,
      );
      expect(res.status).toBe(409);
      expect((await res.json()).error.missing).toEqual([1, 2]);
      const abort = await api.upload.abort(
        req(`/api/admin/uploads/${state.uploadId}`, { method: 'DELETE' }),
        state.uploadId,
      );
      expect(abort.status).toBe(204);
    });

    it('rejects a bad part list with 422', async () => {
      current = { kind: 'staff', actor: editor };
      const res = await api.upload.parts(
        post('/api/admin/uploads/x/parts', { partNumbers: 'no' }),
        'x',
      );
      expect(res.status).toBe(422);
    });
  });

  describe('dev routes', () => {
    it('refuses unsigned or altered storage urls', async () => {
      expect(
        (await api.devStorage(req('/api/dev-storage/originals/get?key=a&sig=bad&exp=9999999999')))
          .status,
      ).toBe(403);
    });

    it('serves media only with a valid signature, and never from the originals bucket', async () => {
      expect(
        (await api.devMedia(req('/api/dev-media/v/x/360/seg_00000.ts'), 'v/x/360/seg_00000.ts'))
          .status,
      ).toBe(403);
      expect((await api.devMedia(req('/api/dev-media/templates/a'), 'templates/a')).status).toBe(
        404,
      );
    });
  });

  describe('playback', () => {
    it('needs a signed in viewer for the session', async () => {
      current = { kind: 'none' };
      const res = await api.play.session(
        post(`/api/play/${video.id}/session`, { profileId: viewer.profileId }),
        video.id,
      );
      expect(res.status).toBe(401);
    });

    it('refuses a cross-origin session request', async () => {
      current = { kind: 'viewer' };
      const res = await api.play.session(
        post(
          `/api/play/${video.id}/session`,
          { profileId: viewer.profileId },
          { origin: 'https://evil.test' },
        ),
        video.id,
      );
      expect(res.status).toBe(403);
    });

    it('answers 404 for an unpublished video and 403 for another profile', async () => {
      current = { kind: 'viewer' };
      const draft = await seedVideo(h.db.setup, { publishState: 'draft', title: 'Draft' });
      expect(
        (
          await api.play.session(
            post(`/api/play/${draft.id}/session`, { profileId: viewer.profileId }),
            draft.id,
          )
        ).status,
      ).toBe(404);
      const stranger = await h.makeUser();
      expect(
        (
          await api.play.session(
            post(`/api/play/${video.id}/session`, { profileId: stranger.profileId }),
            video.id,
          )
        ).status,
      ).toBe(403);
    });

    it('answers 429 with retry-after when the limiter denies', async () => {
      current = { kind: 'viewer' };
      limited = 1;
      const res = await api.play.session(
        post(`/api/play/${video.id}/session`, { profileId: viewer.profileId }),
        video.id,
      );
      expect(res.status).toBe(429);
      expect(res.headers.get('retry-after')).toBe('17');
    });

    it('runs the whole chain: session, master, variant with signed segments, key bytes', async () => {
      current = { kind: 'viewer' };
      const session = await (
        await api.play.session(
          post(`/api/play/${video.id}/session`, { profileId: viewer.profileId }),
          video.id,
        )
      ).json();
      expect(session.masterUrl).toBe(`${ORIGIN}/api/play/${video.id}/master.m3u8`);
      const auth = { authorization: `Bearer ${session.token}` };

      const master = await api.play.playlist(
        req(`/api/play/${video.id}/master.m3u8`, { headers: auth }),
        video.id,
        'master.m3u8',
      );
      expect(master.status).toBe(200);
      expect(master.headers.get('cache-control')).toBe('private, no-store');
      expect(await master.text()).toContain(`${ORIGIN}/api/play/${video.id}/360.m3u8`);

      const variant = await api.play.playlist(
        req(`/api/play/${video.id}/360.m3u8`, { headers: auth }),
        video.id,
        '360.m3u8',
      );
      const body = await variant.text();
      expect(body).toContain(`${ORIGIN}/api/hls/keys/${video.id}`);
      expect(body).toMatch(/\/api\/dev-media\/v\/.+\/360\/seg_00000\.ts\?exp=\d+&sig=/);

      const native = await api.play.playlist(
        req(`/api/play/${video.id}/master.m3u8?pt=${session.token}`),
        video.id,
        'master.m3u8',
      );
      expect(await native.text()).toContain(`360.m3u8?pt=${session.token}`);

      const key = await api.play.key(req(`/api/hls/keys/${video.id}`, { headers: auth }), video.id);
      expect(key.status).toBe(200);
      expect(new Uint8Array(await key.arrayBuffer())).toEqual(key16);
      expect(key.headers.get('cache-control')).toBe('private, no-store');
    });

    it('refuses playlists and keys without a token, with a wrong file name, or for another video', async () => {
      current = { kind: 'none' };
      expect(
        (await api.play.playlist(req(`/api/play/${video.id}/master.m3u8`), video.id, 'master.m3u8'))
          .status,
      ).toBe(401);
      expect((await api.play.key(req(`/api/hls/keys/${video.id}`), video.id)).status).toBe(401);
      expect(
        (await api.play.playlist(req(`/api/play/${video.id}/evil.m3u8`), video.id, 'evil.m3u8'))
          .status,
      ).toBe(404);
    });

    it('gives staff a preview token', async () => {
      current = { kind: 'staff', actor: editor };
      const res = await api.play.session(
        post(`/api/play/${video.id}/session`, { preview: true }),
        video.id,
      );
      expect(res.status).toBe(200);
      expect((await res.json()).preview).toBe(true);
    });
  });

  describe('guest playback (M40-S02, S03)', () => {
    const session = (headers: HeadersInit = {}, id = video.id) =>
      api.play.session(post(`/api/play/${id}/session`, {}, headers), id);
    const cookieOf = (res: Response) => res.headers.getSetCookie()[0]!.split(';')[0]!;

    it('plays the whole chain with no account and one guest cookie', async () => {
      current = { kind: 'none' };
      guestPlay = true;
      guestKids = false;
      const res = await session();
      expect(res.status).toBe(200);
      const cookies = res.headers.getSetCookie();
      expect(cookies).toHaveLength(1);
      expect(cookies[0]).toMatch(
        /^__Host-ad_guest=[^;]+; Max-Age=15552000; Path=\/; HttpOnly; Secure; SameSite=Lax$/,
      );
      const info = await res.json();
      const auth = { authorization: `Bearer ${info.token}` };
      const master = await api.play.playlist(
        req(`/api/play/${video.id}/master.m3u8`, { headers: auth }),
        video.id,
        'master.m3u8',
      );
      expect(master.status).toBe(200);
      const variant = await api.play.playlist(
        req(`/api/play/${video.id}/360.m3u8`, { headers: auth }),
        video.id,
        '360.m3u8',
      );
      const body = await variant.text();
      const exp = Number(/seg_00000\.ts\?exp=(\d+)/.exec(body)![1]);
      const lifetime = exp - Math.floor(Date.now() / 1000);
      expect(lifetime).toBeLessThanOrEqual(20 * 60);
      expect(lifetime).toBeGreaterThan(19 * 60);
      const key = await api.play.key(req(`/api/hls/keys/${video.id}`, { headers: auth }), video.id);
      expect(key.status).toBe(200);
      expect(new Uint8Array(await key.arrayBuffer())).toEqual(key16);
    });

    it('sets no cookie when a valid guest cookie is sent', async () => {
      current = { kind: 'none' };
      guestPlay = true;
      const first = await session();
      const second = await session({ cookie: cookieOf(first) });
      expect(second.status).toBe(200);
      expect(second.headers.getSetCookie()).toEqual([]);
    });

    it('treats a forged cookie as absent and issues a fresh one', async () => {
      current = { kind: 'none' };
      guestPlay = true;
      const id = 'AAAAAAAAAAAAAAAAAAAAAA';
      const forged = `${guestCookieName(true)}=${id}.forgedforgedforgedforgedforgedforgedforgedfo`;
      const res = await session({ cookie: forged });
      expect(res.status).toBe(200);
      expect(res.headers.getSetCookie()).toHaveLength(1);
      expect(res.headers.getSetCookie()[0]).not.toContain(id);
      const wrongKey = `${guestCookieName(true)}=${signGuest(new Uint8Array(32).fill(1), id)}`;
      expect((await session({ cookie: wrongKey })).headers.getSetCookie()).toHaveLength(1);
    });

    it('answers 401 when guest play is off, and an account session still wins when on', async () => {
      current = { kind: 'none' };
      guestPlay = false;
      expect((await session()).status).toBe(401);
      guestPlay = true;
      current = { kind: 'viewer' };
      const res = await api.play.session(
        post(`/api/play/${video.id}/session`, { profileId: viewer.profileId }),
        video.id,
      );
      expect(res.status).toBe(200);
      expect(res.headers.getSetCookie()).toEqual([]);
    });

    it('refuses a cross origin guest request and sets no cookie', async () => {
      current = { kind: 'none' };
      guestPlay = true;
      const res = await session({ origin: 'https://evil.test' });
      expect(res.status).toBe(403);
      expect(res.headers.getSetCookie()).toEqual([]);
    });

    it('answers 404 for a draft video', async () => {
      current = { kind: 'none' };
      guestPlay = true;
      const draft = await seedVideo(h.db.setup, { publishState: 'draft', title: 'Draft G' });
      expect((await session({}, draft.id)).status).toBe(404);
    });

    it('gives a Kids mode guest no session for a video that is not kids safe', async () => {
      current = { kind: 'none' };
      guestPlay = true;
      const adult = await seedVideo(h.db.setup, { kidsSafe: false, title: 'Adult G' });
      guestKids = true;
      try {
        expect((await session({}, adult.id)).status).toBe(404);
        expect((await session()).status).toBe(200);
      } finally {
        guestKids = false;
      }
    });

    it('never gives a guest a staff preview', async () => {
      current = { kind: 'none' };
      guestPlay = true;
      const res = await api.play.session(
        post(`/api/play/${video.id}/session`, { preview: true }),
        video.id,
      );
      expect(res.status).toBe(401);
    });
  });

  describe('encoding status', () => {
    it('is staff only', async () => {
      current = { kind: 'none' };
      expect(
        (await api.admin.encoding(req(`/api/admin/videos/${video.id}/encoding`), video.id)).status,
      ).toBe(401);
      current = { kind: 'viewer' };
      expect(
        (await api.admin.encoding(req(`/api/admin/videos/${video.id}/encoding`), video.id)).status,
      ).toBe(403);
    });

    it('reports status, jobs and renditions in plain words', async () => {
      current = { kind: 'staff', actor: editor };
      const id = uuidv7();
      await h.db.setup.insert(schema.videos).values({
        id,
        slug: `failed-${id.slice(-6)}`,
        title: 'Failed one',
        status: 'failed',
        failureCode: 'unreadable',
        failureMessage: 'This file could not be read.',
        mediaPrefix: `p${id.slice(-8)}`,
      } as never);
      await h.db.setup.insert(schema.jobs).values({
        id: uuidv7(),
        queue: 'video.probe',
        videoId: id,
        status: 'failed',
        progress: 10,
        errorMessage: 'This file could not be read.',
        errorDetail: 'moov atom not found',
      } as never);
      const res = await api.admin.encoding(req(`/api/admin/videos/${id}/encoding`), id);
      const body = await res.json();
      expect(res.status).toBe(200);
      expect(body.video).toMatchObject({
        status: 'failed',
        failureMessage: 'This file could not be read.',
      });
      expect(body.jobs[0]).toMatchObject({ queue: 'video.probe', status: 'failed', progress: 10 });
      expect(body.renditions).toEqual([]);
      expect(
        (await api.admin.encoding(req('/api/admin/videos/nope/encoding'), 'nope')).status,
      ).toBe(404);
    });
  });

  describe('captions and publish', () => {
    it('lists tracks, approves a revision, and the session then carries the track', async () => {
      current = { kind: 'staff', actor: editor };
      const vtt = 'WEBVTT\n\n00:00:00.000 --> 00:00:02.000\nHello there\n';
      const captions = new CaptionService({
        db: h.db.app,
        originals,
        media,
        producer: { enqueue: async () => ({ jobId: 'j', deduped: false }) },
      });
      const row = await captions.importFile(editor, video.id, 'a.vtt', vtt, 'en');
      const list = await api.admin.captions.list(
        req(`/api/admin/videos/${video.id}/captions`),
        video.id,
      );
      const tracks = (await list.json()).tracks;
      expect(tracks[0]).toMatchObject({ language: 'en', state: 'needs_review' });

      const captionId = tracks[0].latestRevisionId ?? row.id;
      current = { kind: 'viewer' };
      expect(
        (
          await api.admin.captions.approve(
            post(`/api/admin/captions/${captionId}/approve`),
            captionId,
          )
        ).status,
      ).toBe(403);
      current = { kind: 'staff', actor: editor };
      const ok = await api.admin.captions.approve(
        post(`/api/admin/captions/${captionId}/approve`),
        captionId,
      );
      expect(ok.status).toBe(200);

      current = { kind: 'viewer' };
      const session = await (
        await api.play.session(
          post(`/api/play/${video.id}/session`, { profileId: viewer.profileId }),
          video.id,
        )
      ).json();
      expect(session.captions).toHaveLength(1);
      expect(session.captions[0].url).toContain('/api/dev-media/cap/');
      const vttRes = await api.devMedia(
        req(new URL(session.captions[0].url).pathname),
        new URL(session.captions[0].url).pathname.replace('/api/dev-media/', ''),
      );
      expect(vttRes.status).toBe(200);
      expect(await vttRes.text()).toContain('Hello there');
    });

    it('publishes only when the checklist passes, and is staff only', async () => {
      const id = video.id;
      current = { kind: 'viewer' };
      expect((await api.admin.publish(post(`/api/admin/videos/${id}/publish`), id)).status).toBe(
        403,
      );
      current = { kind: 'staff', actor: editor };
      const draft = await seedVideo(h.db.setup, {
        publishState: 'draft',
        title: 'Incomplete',
        description: null,
      });
      const res = await api.admin.publish(post(`/api/admin/videos/${draft.id}/publish`), draft.id);
      expect(res.status).toBe(422);
    });
  });
});
