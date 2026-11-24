import { createHarness, integrationEnabled, type ViewerHarness } from '@ad/viewer/testing';
import type { Actor } from '@ad/shared';
import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createViewerApi, type ViewerRuntime } from './api';

const ORIGIN = 'https://app.test';

describe.skipIf(!integrationEnabled())('notices api (M44-S11, S14, S17)', () => {
  let h: ViewerHarness;
  let api: ReturnType<typeof createViewerApi>;
  let me: Awaited<ReturnType<ViewerHarness['makeUser']>>;
  let signedIn: Actor | null;
  let lock = { sessionId: 's', profileId: null as string | null, kidsLocked: false };

  const req = (method: string, path: string, body?: unknown, origin: string | null = ORIGIN) => {
    const headers = new Headers();
    if (origin && method !== 'GET') headers.set('origin', origin);
    return new Request(`${ORIGIN}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  };

  beforeAll(async () => {
    h = await createHarness();
    me = await h.makeUser();
    for (let i = 0; i < 3; i += 1)
      await h.db.setup.execute(sql`
        INSERT INTO viewer_notices (profile_id, kind, title, href, dedupe_key)
        VALUES (${me.profileId}::uuid, 'new_video', ${`T${i}`}, '/browse', ${`k${i}`})`);
    const runtime: ViewerRuntime = {
      ctx: h.ctx,
      appOrigin: ORIGIN,
      secureCookies: false,
      profileSecret: new Uint8Array(32).fill(9),
      resolveActor: async () => signedIn,
      sealAddress: async () => ({ sealed: new Uint8Array([7, 7, 7]), masked: 'a***@example.org' }),
      lock: { read: async () => lock, set: async () => undefined, clear: async () => undefined },
    };
    api = createViewerApi(runtime);
  });
  afterAll(async () => {
    await h?.drop();
  });

  it('GET lists the newest first with the unread count, and the count route is cheap', async () => {
    signedIn = me.actor;
    const list = await api.notices.list(req('GET', `/api/notices?profileId=${me.profileId}&limit=2`));
    expect(list.status).toBe(200);
    const body = await list.json();
    expect(body.items).toHaveLength(2);
    expect(body.unread).toBe(3);
    expect(body.nextCursor).toBeTruthy();
    const count = await api.notices.count(req('GET', `/api/notices/count?profileId=${me.profileId}`));
    expect(await count.json()).toEqual({ count: 3 });
  });

  it('POST marks one notice or all as read and validates the body', async () => {
    signedIn = me.actor;
    const list = await (await api.notices.list(req('GET', `/api/notices?profileId=${me.profileId}`))).json();
    const one = await api.notices.markRead(
      req('POST', '/api/notices', { profileId: me.profileId, ids: [list.items[0].id] }),
    );
    expect(await one.json()).toEqual({ updated: 1 });
    const all = await api.notices.markRead(req('POST', '/api/notices', { profileId: me.profileId, ids: 'all' }));
    expect(await all.json()).toEqual({ updated: 2 });
    expect((await api.notices.markRead(req('POST', '/api/notices', { profileId: me.profileId, ids: [] }))).status).toBe(422);
    expect((await api.notices.markRead(req('POST', '/api/notices', { profileId: me.profileId }))).status).toBe(422);
    expect(
      (await api.notices.markRead(req('POST', '/api/notices', { profileId: me.profileId, ids: 'all' }, 'https://evil.test'))).status,
    ).toBe(403);
  });

  it('answers 401 without a session', async () => {
    signedIn = null;
    expect((await api.notices.list(req('GET', `/api/notices?profileId=${me.profileId}`))).status).toBe(401);
    expect((await api.notices.count(req('GET', `/api/notices/count?profileId=${me.profileId}`))).status).toBe(401);
    expect((await api.notificationPrefs.get(req('GET', `/api/account/notifications?profileId=${me.profileId}`))).status).toBe(401);
  });

  it('a kids profile gets 403 kids_no_notices, a zero count, and the lock blocks other profiles', async () => {
    signedIn = me.actor;
    const kids = await api.notices.list(req('GET', `/api/notices?profileId=${me.kidsProfileId}`));
    expect(kids.status).toBe(403);
    expect((await kids.json()).error.message).toBe('kids_no_notices');
    const count = await api.notices.count(req('GET', `/api/notices/count?profileId=${me.kidsProfileId}`));
    expect(await count.json()).toEqual({ count: 0 });
    const prefs = await api.notificationPrefs.get(req('GET', `/api/account/notifications?profileId=${me.kidsProfileId}`));
    expect(prefs.status).toBe(403);
    lock = { sessionId: 's', profileId: me.kidsProfileId, kidsLocked: true };
    const gated = await api.notices.list(req('GET', `/api/notices?profileId=${me.profileId}`));
    expect((await gated.json()).error.message).toBe('kids_gate');
    lock = { sessionId: 's', profileId: null, kidsLocked: false };
  });

  it('preferences read defaults and save only the switches that were sent', async () => {
    signedIn = me.actor;
    const got = await api.notificationPrefs.get(req('GET', `/api/account/notifications?profileId=${me.profileId}`));
    expect(await got.json()).toMatchObject({ bell: true, newEpisodes: true, newVideos: true, emailFrequency: 'off' });
    const saved = await api.notificationPrefs.set(
      req('PUT', '/api/account/notifications', { profileId: me.profileId, newVideos: false }),
    );
    expect(await saved.json()).toMatchObject({ newVideos: false, newEpisodes: true });
    expect(
      (await api.notificationPrefs.set(req('PUT', '/api/account/notifications', { profileId: me.profileId, bell: 'no' }))).status,
    ).toBe(422);
  });

  it('PUT email needs the confirmation, then stores the consent, shows the masked address, and off clears it', async () => {
    signedIn = me.actor;
    const put = (email: unknown) =>
      api.notificationPrefs.set(req('PUT', '/api/account/notifications', { profileId: me.profileId, email }));
    expect((await put({ frequency: 'daily' })).status).toBe(422);
    const on = await put({ frequency: 'weekly', confirm: true });
    expect(on.status).toBe(200);
    expect(await on.json()).toMatchObject({ emailFrequency: 'weekly', addressMasked: 'a***@example.org', hasAddress: true });
    const got = await (await api.notificationPrefs.get(req('GET', `/api/account/notifications?profileId=${me.profileId}`))).json();
    expect(got.consentedAt).toBeTruthy();
    expect((await put({ frequency: 'monthly' })).status).toBe(422);
    const off = await (await put({ frequency: 'off' })).json();
    expect(off).toMatchObject({ emailFrequency: 'off', addressMasked: null, hasAddress: false, consentedAt: null });
  });

  it('reading the settings seals the address again after an account email change cleared it', async () => {
    signedIn = me.actor;
    await api.notificationPrefs.set(
      req('PUT', '/api/account/notifications', { profileId: me.profileId, email: { frequency: 'daily', confirm: true } }),
    );
    await h.db.setup.execute(sql`UPDATE viewer_notification_prefs SET address_enc = NULL WHERE account_id = ${me.accountId}::uuid`);
    const got = await (await api.notificationPrefs.get(req('GET', `/api/account/notifications?profileId=${me.profileId}`))).json();
    expect(got).toMatchObject({ emailFrequency: 'daily', hasAddress: true });
    const row = await h.db.setup.execute(sql`SELECT address_enc FROM viewer_notification_prefs WHERE account_id = ${me.accountId}::uuid`);
    expect((row.rows[0] as { address_enc: Buffer }).address_enc.length).toBe(3);
  });
});
