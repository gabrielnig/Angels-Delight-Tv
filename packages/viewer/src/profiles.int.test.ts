import { eq, sql } from 'drizzle-orm';
import { myList, profiles, watchProgress } from '@ad/db';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PROFILE_LIMIT_MESSAGE } from './profiles';
import {
  createProfile,
  deleteProfile,
  exitKidsMode,
  listProfiles,
  selectProfile,
  updateProfile,
} from './profiles';
import {
  createHarness,
  integrationEnabled,
  seedAccount,
  seedVideo,
  TEST_PASSWORD,
  type ViewerHarness,
} from './testing';

describe.skipIf(!integrationEnabled())('profiles', () => {
  let h: ViewerHarness;

  beforeAll(async () => {
    h = await createHarness();
  });
  afterAll(async () => {
    await h?.drop();
  });

  describe('listProfiles', () => {
    it('returns the account profiles in order with decrypted names and no secrets', async () => {
      const user = await h.makeUser();

      const list = await listProfiles(h.ctx, user.actor);

      expect(list.map((p) => p.name)).toEqual(['Grown up', 'Little one']);
      expect(list.map((p) => p.isKids)).toEqual([false, true]);
      expect(Object.keys(list[0]!).sort()).toEqual(
        [
          'autoplayNext',
          'avatarId',
          'dataSaver',
          'hasPin',
          'id',
          'isKids',
          'isPrimary',
          'language',
          'name',
          'position',
          'updatedAt',
        ].sort(),
      );
    });

    it('does not show another account the profiles of this one', async () => {
      const owner = await h.makeUser();
      const stranger = await h.makeUser();

      const list = await listProfiles(h.ctx, stranger.actor);

      expect(list.map((p) => p.id)).not.toContain(owner.profileId);
      expect(list).toHaveLength(2);
    });
  });

  describe('createProfile', () => {
    it('makes the first profile of an account the primary one', async () => {
      const account = await seedAccount(h.db.setup);
      const actor = { accountId: account.id, role: 'viewer' as const };

      const created = await createProfile(h.ctx, actor, { name: 'First', avatarId: 'sun' });

      expect(created).toMatchObject({ name: 'First', isPrimary: true, isKids: false, position: 0 });
    });

    it('refuses a kids flag on the first profile because someone must manage the account', async () => {
      const account = await seedAccount(h.db.setup);
      const actor = { accountId: account.id, role: 'viewer' as const };

      await expect(
        createProfile(h.ctx, actor, { name: 'Child', avatarId: 'sun', isKids: true }),
      ).rejects.toMatchObject({ code: 'validation_failed' });
    });

    it('stores the name encrypted, not as plain text', async () => {
      const user = await h.makeUser();

      const created = await createProfile(h.ctx, user.actor, {
        name: 'Secret name',
        avatarId: 'moon',
      });

      const stored = await h.db.setup
        .select({ nameEnc: profiles.nameEnc })
        .from(profiles)
        .where(eq(profiles.id, created.id));
      expect(stored[0]!.nameEnc.toString('utf8')).not.toContain('Secret name');
    });

    it('trims and collapses spaces in the name', async () => {
      const user = await h.makeUser();

      const created = await createProfile(h.ctx, user.actor, {
        name: '  Ada   Obi  ',
        avatarId: 'sun',
      });

      expect(created.name).toBe('Ada Obi');
    });

    it.each([
      ['an empty name', ''],
      ['a name of only spaces', '    '],
      ['a name over 20 characters', 'x'.repeat(21)],
      ['a name with an emoji', 'Sun \u{1F31E}'],
    ])('rejects %s', async (_label, name) => {
      const user = await h.makeUser();

      await expect(
        createProfile(h.ctx, user.actor, { name, avatarId: 'sun' }),
      ).rejects.toMatchObject({
        code: 'validation_failed',
        fields: { name: expect.any(Array) },
      });
    });

    it('rejects an avatar that is not in the preset list', async () => {
      const user = await h.makeUser();

      await expect(
        createProfile(h.ctx, user.actor, { name: 'Zed', avatarId: 'https://evil.test/x.png' }),
      ).rejects.toMatchObject({
        code: 'validation_failed',
        fields: { avatarId: expect.any(Array) },
      });
    });

    it('rejects a duplicate name in the same account, ignoring case', async () => {
      const user = await h.makeUser();

      await expect(
        createProfile(h.ctx, user.actor, { name: 'GROWN UP', avatarId: 'sun' }),
      ).rejects.toMatchObject({ code: 'conflict' });
    });

    it('allows the same name in a different account', async () => {
      const first = await h.makeUser();
      const second = await h.makeUser();

      await expect(
        createProfile(h.ctx, second.actor, { name: 'Shared name', avatarId: 'sun' }),
      ).resolves.toBeDefined();
      await expect(
        createProfile(h.ctx, first.actor, { name: 'Shared name', avatarId: 'sun' }),
      ).resolves.toBeDefined();
    });

    it('stops at the profile limit with a readable message', async () => {
      const user = await h.makeUser();
      for (const name of ['Third', 'Fourth', 'Fifth']) {
        await createProfile(h.ctx, user.actor, { name, avatarId: 'sun' });
      }

      await expect(
        createProfile(h.ctx, user.actor, { name: 'Sixth', avatarId: 'sun' }),
      ).rejects.toMatchObject({ code: 'conflict', message: PROFILE_LIMIT_MESSAGE });
    });

    it('cannot be done from inside a kids profile', async () => {
      const user = await h.makeUser();

      await expect(
        createProfile(
          h.ctx,
          user.actor,
          { name: 'Sneaky', avatarId: 'sun' },
          { activeProfileId: user.kidsProfileId },
        ),
      ).rejects.toMatchObject({ code: 'forbidden' });
    });
  });

  describe('updateProfile', () => {
    it('changes the name and avatar and bumps the version', async () => {
      const user = await h.makeUser();

      const updated = await updateProfile(h.ctx, user.actor, user.profileId, {
        name: 'Renamed',
        avatarId: 'leaf',
        autoplayNext: false,
        dataSaver: true,
      });

      expect(updated).toMatchObject({
        name: 'Renamed',
        avatarId: 'leaf',
        autoplayNext: false,
        dataSaver: true,
      });
    });

    it('rejects an update made from a stale copy of the profile', async () => {
      const user = await h.makeUser();
      const before = (await listProfiles(h.ctx, user.actor))[0]!;
      await updateProfile(h.ctx, user.actor, user.profileId, { avatarId: 'leaf' });

      await expect(
        updateProfile(
          h.ctx,
          user.actor,
          user.profileId,
          { avatarId: 'moon' },
          { expectedUpdatedAt: before.updatedAt },
        ),
      ).rejects.toMatchObject({ code: 'conflict' });
    });

    it('turns on kids rules without a password when another adult profile exists', async () => {
      const user = await h.makeUser();
      const second = await createProfile(h.ctx, user.actor, {
        name: 'Second adult',
        avatarId: 'sun',
      });

      const updated = await updateProfile(h.ctx, user.actor, second.id, { isKids: true });

      expect(updated.isKids).toBe(true);
    });

    it('keeps at least one grown-up profile', async () => {
      const user = await h.makeUser();

      await expect(
        updateProfile(h.ctx, user.actor, user.profileId, { isKids: true }),
      ).rejects.toMatchObject({ code: 'conflict', message: 'Keep at least one grown-up profile' });
    });

    it('needs the account password to turn kids rules off', async () => {
      const user = await h.makeUser();

      await expect(
        updateProfile(h.ctx, user.actor, user.kidsProfileId, { isKids: false }),
      ).rejects.toMatchObject({ code: 'forbidden' });
      await expect(
        updateProfile(
          h.ctx,
          user.actor,
          user.kidsProfileId,
          { isKids: false },
          { password: 'wrong' },
        ),
      ).rejects.toMatchObject({ code: 'forbidden' });
      const updated = await updateProfile(
        h.ctx,
        user.actor,
        user.kidsProfileId,
        { isKids: false },
        { password: TEST_PASSWORD },
      );
      expect(updated.isKids).toBe(false);
    });

    it('is blocked while a kids profile is the active one', async () => {
      const user = await h.makeUser();

      await expect(
        updateProfile(
          h.ctx,
          user.actor,
          user.profileId,
          { name: 'Hacked' },
          { activeProfileId: user.kidsProfileId },
        ),
      ).rejects.toMatchObject({ code: 'forbidden' });
    });

    it('refuses a name another profile in the account already uses', async () => {
      const user = await h.makeUser();

      await expect(
        updateProfile(h.ctx, user.actor, user.kidsProfileId, { name: 'grown up' }),
      ).rejects.toMatchObject({ code: 'conflict' });
    });
  });

  describe('deleteProfile', () => {
    it('removes the profile together with its progress and list', async () => {
      const user = await h.makeUser();
      const video = await seedVideo(h.db.setup);
      await h.db.setup
        .insert(watchProgress)
        .values({
          profileId: user.kidsProfileId,
          videoId: video.id,
          positionMs: 9000,
          durationMs: 120000,
        });
      await h.db.setup.insert(myList).values({ profileId: user.kidsProfileId, videoId: video.id });

      await deleteProfile(h.ctx, user.actor, user.kidsProfileId);

      const left = await h.db.setup.execute(
        sql`SELECT (SELECT count(*) FROM watch_progress WHERE profile_id = ${user.kidsProfileId}) AS progress,
                   (SELECT count(*) FROM my_list WHERE profile_id = ${user.kidsProfileId}) AS list`,
      );
      expect((left as unknown as { rows: { progress: string; list: string }[] }).rows[0]).toEqual({
        progress: '0',
        list: '0',
      });
    });

    it('keeps the last profile', async () => {
      const account = await seedAccount(h.db.setup);
      const actor = { accountId: account.id, role: 'viewer' as const };
      const only = await createProfile(h.ctx, actor, { name: 'Only', avatarId: 'sun' });

      await expect(deleteProfile(h.ctx, actor, only.id)).rejects.toMatchObject({
        code: 'conflict',
        message: 'You need at least one profile',
      });
    });

    it('keeps the last grown-up profile', async () => {
      const user = await h.makeUser();

      await expect(deleteProfile(h.ctx, user.actor, user.profileId)).rejects.toMatchObject({
        code: 'conflict',
        message: 'Keep at least one grown-up profile',
      });
    });

    it('makes another grown-up profile the primary one when the primary is deleted', async () => {
      const user = await h.makeUser();
      const second = await createProfile(h.ctx, user.actor, { name: 'Second', avatarId: 'sun' });

      await deleteProfile(h.ctx, user.actor, user.profileId);

      const list = await listProfiles(h.ctx, user.actor);
      expect(list.find((p) => p.id === second.id)?.isPrimary).toBe(true);
    });

    it('is blocked while a kids profile is the active one', async () => {
      const user = await h.makeUser();
      const second = await createProfile(h.ctx, user.actor, { name: 'Second', avatarId: 'sun' });

      await expect(
        deleteProfile(h.ctx, user.actor, second.id, { activeProfileId: user.kidsProfileId }),
      ).rejects.toMatchObject({ code: 'forbidden' });
    });
  });

  describe('ownership', () => {
    it('answers not found, never forbidden, for a profile of another account', async () => {
      const owner = await h.makeUser();
      const stranger = await h.makeUser();

      await expect(
        updateProfile(h.ctx, stranger.actor, owner.profileId, { name: 'Taken over' }),
      ).rejects.toMatchObject({ code: 'not_found' });
      await expect(deleteProfile(h.ctx, stranger.actor, owner.profileId)).rejects.toMatchObject({
        code: 'not_found',
      });
      await expect(selectProfile(h.ctx, stranger.actor, owner.profileId)).rejects.toMatchObject({
        code: 'not_found',
      });
    });

    it('does not let an admin account act on a viewer profile through the viewer API', async () => {
      const owner = await h.makeUser();
      const admin = await h.makeUser('admin');

      await expect(selectProfile(h.ctx, admin.actor, owner.profileId)).rejects.toMatchObject({
        code: 'not_found',
      });
      await expect(
        updateProfile(h.ctx, admin.actor, owner.profileId, { name: 'Admin edit' }),
      ).rejects.toMatchObject({ code: 'not_found' });
      expect((await listProfiles(h.ctx, admin.actor)).map((p) => p.id)).not.toContain(
        owner.profileId,
      );
    });

    it('answers not found for an id that is not a uuid', async () => {
      const user = await h.makeUser();

      await expect(selectProfile(h.ctx, user.actor, 'not-a-uuid')).rejects.toMatchObject({
        code: 'not_found',
      });
    });
  });

  describe('selectProfile and kids exit', () => {
    it('returns the profile when the account owns it', async () => {
      const user = await h.makeUser();

      const selected = await selectProfile(h.ctx, user.actor, user.kidsProfileId);

      expect(selected).toMatchObject({ id: user.kidsProfileId, isKids: true });
    });

    it('asks for the PIN of a profile that has one and rejects a wrong PIN', async () => {
      const user = await h.makeUser();
      await updateProfile(
        h.ctx,
        user.actor,
        user.profileId,
        { pin: '4821' },
        { password: TEST_PASSWORD },
      );

      await expect(selectProfile(h.ctx, user.actor, user.profileId)).rejects.toMatchObject({
        code: 'forbidden',
        message: 'pin_required',
      });
      await expect(
        selectProfile(h.ctx, user.actor, user.profileId, { pin: '0000' }),
      ).rejects.toMatchObject({ code: 'forbidden', message: 'pin_invalid' });
      await expect(
        selectProfile(h.ctx, user.actor, user.profileId, { pin: '4821' }),
      ).resolves.toMatchObject({ id: user.profileId, hasPin: true });
    });

    it('stops PIN guessing when the rate limiter says no', async () => {
      const limited = await createHarness({ rateLimit: async () => false });
      try {
        const user = await limited.makeUser();
        await updateProfile(
          limited.ctx,
          user.actor,
          user.profileId,
          { pin: '4821' },
          { password: TEST_PASSWORD },
        );

        await expect(
          selectProfile(limited.ctx, user.actor, user.profileId, { pin: '4821' }),
        ).rejects.toMatchObject({ code: 'rate_limited' });
      } finally {
        await limited.drop();
      }
    });

    it('lets a kids profile be left only with the account password', async () => {
      const user = await h.makeUser();

      await expect(exitKidsMode(h.ctx, user.actor, { password: 'nope' })).rejects.toMatchObject({
        code: 'forbidden',
      });
      await expect(exitKidsMode(h.ctx, user.actor, { password: TEST_PASSWORD })).resolves.toEqual({
        ok: true,
      });
    });
  });
});
