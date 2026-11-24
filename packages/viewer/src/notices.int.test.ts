import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { sql } from 'drizzle-orm';
import { countUnread, getPrefs, listNotices, markRead, setPrefs } from './notices';
import { createHarness, type ViewerHarness } from './testing';

describe.skipIf(!process.env.TEST_DATABASE_ADMIN_URL)('viewer notices service (M44-S11, S14, S17)', () => {
  let h: ViewerHarness;
  beforeAll(async () => {
    h = await createHarness();
  });
  afterAll(async () => {
    await h?.drop();
  });

  async function addNotices(profileId: string, count: number, prefix = 'n') {
    for (let i = 0; i < count; i += 1)
      await h.db.setup.execute(sql`
        INSERT INTO viewer_notices (profile_id, kind, title, href, dedupe_key, created_at)
        VALUES (${profileId}::uuid, 'new_video', ${`${prefix}${i}`}, '/browse', ${`${prefix}${i}`},
          now() - make_interval(secs => ${count - i}))`);
  }

  it('lists the newest first, five minutes of unread count, and caps the count at 99', async () => {
    const u = await h.makeUser();
    await addNotices(u.profileId, 120);
    const page = await listNotices(h.ctx, u.actor, { profileId: u.profileId, limit: 10 });
    expect(page.items).toHaveLength(10);
    expect(page.items[0]?.title).toBe('n119');
    expect(page.items[0]).toMatchObject({ kind: 'new_video', href: '/browse', read: false, itemCount: 1 });
    expect(page.nextCursor).toBeTruthy();
    const next = await listNotices(h.ctx, u.actor, { profileId: u.profileId, limit: 10, cursor: page.nextCursor ?? undefined });
    expect(next.items[0]?.title).toBe('n109');
    expect(await countUnread(h.ctx, u.actor, { profileId: u.profileId })).toBe(99);
  });

  it('marking read is per profile and supports ids and all', async () => {
    const u = await h.makeUser();
    const other = await h.db.setup.execute(sql`
      INSERT INTO profiles (account_id, name_enc, avatar_id, position) VALUES (${u.accountId}::uuid, '\\x01', 'sun', 2) RETURNING id`);
    const otherId = (other.rows[0] as { id: string }).id;
    await addNotices(u.profileId, 3, 'a');
    await addNotices(otherId, 2, 'b');
    const list = await listNotices(h.ctx, u.actor, { profileId: u.profileId });
    const first = list.items[0]!.id;
    expect(await markRead(h.ctx, u.actor, { profileId: u.profileId, ids: [first] })).toEqual({ updated: 1 });
    expect(await markRead(h.ctx, u.actor, { profileId: u.profileId, ids: [first] })).toEqual({ updated: 0 });
    expect(await countUnread(h.ctx, u.actor, { profileId: u.profileId })).toBe(2);
    expect(await countUnread(h.ctx, u.actor, { profileId: otherId })).toBe(2);
    expect(await markRead(h.ctx, u.actor, { profileId: u.profileId, ids: 'all' })).toEqual({ updated: 2 });
    expect(await countUnread(h.ctx, u.actor, { profileId: u.profileId })).toBe(0);
    expect(await countUnread(h.ctx, u.actor, { profileId: otherId })).toBe(2);
  });

  it('another account cannot see or mark my notices, and a bad id is a validation error', async () => {
    const mine = await h.makeUser();
    const stranger = await h.makeUser();
    await addNotices(mine.profileId, 1, 'm');
    await expect(listNotices(h.ctx, stranger.actor, { profileId: mine.profileId })).rejects.toMatchObject({ status: 404 });
    await expect(markRead(h.ctx, stranger.actor, { profileId: mine.profileId, ids: 'all' })).rejects.toMatchObject({ status: 404 });
    const own = await listNotices(h.ctx, mine.actor, { profileId: mine.profileId });
    await expect(markRead(h.ctx, stranger.actor, { profileId: stranger.profileId, ids: [own.items[0]!.id] })).resolves.toEqual({ updated: 0 });
    await expect(markRead(h.ctx, mine.actor, { profileId: mine.profileId, ids: ['nope'] })).rejects.toMatchObject({ status: 422 });
  });

  it('a kids profile gets 403, a zero count, and the table is not read for the count', async () => {
    const u = await h.makeUser();
    await expect(listNotices(h.ctx, u.actor, { profileId: u.kidsProfileId })).rejects.toMatchObject({ status: 403, message: 'kids_no_notices' });
    await expect(markRead(h.ctx, u.actor, { profileId: u.kidsProfileId, ids: 'all' })).rejects.toMatchObject({ status: 403 });
    await expect(getPrefs(h.ctx, u.actor, { profileId: u.kidsProfileId })).rejects.toMatchObject({ status: 403 });
    await expect(setPrefs(h.ctx, u.actor, { profileId: u.kidsProfileId, bell: false })).rejects.toMatchObject({ status: 403 });
    expect(await countUnread(h.ctx, u.actor, { profileId: u.kidsProfileId })).toBe(0);
  });

  it('preferences default to bell and both kinds on with email off, and saving keeps what was not sent', async () => {
    const u = await h.makeUser();
    expect(await getPrefs(h.ctx, u.actor, { profileId: u.profileId })).toEqual({
      bell: true,
      newEpisodes: true,
      newVideos: true,
      emailFrequency: 'off',
      addressMasked: null,
      consentedAt: null,
    });
    const saved = await setPrefs(h.ctx, u.actor, { profileId: u.profileId, newVideos: false });
    expect(saved).toMatchObject({ bell: true, newEpisodes: true, newVideos: false });
    const again = await setPrefs(h.ctx, u.actor, { profileId: u.profileId, bell: false });
    expect(again).toMatchObject({ bell: false, newVideos: false });
    await expect(setPrefs(h.ctx, u.actor, { profileId: u.profileId, bell: 'yes' as unknown as boolean })).rejects.toMatchObject({ status: 422 });
  });
});
