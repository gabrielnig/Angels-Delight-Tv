import { describe, expect, it } from 'vitest';
import { exitKidsMode, selectProfile, updateProfile } from './profiles';
import { createHarness, TEST_PASSWORD } from './testing';

/**
 * Adversarial cases found in the independent security review (docs/SECURITY-REVIEW.md). Each one is an
 * attack a hostile caller can make with a valid session, so each one must fail on the server.
 */
describe.skipIf(!process.env.TEST_DATABASE_ADMIN_URL)('viewer adversarial cases', () => {
  describe('kids gate on profile switching', () => {
    it('refuses to open a grown-up profile while the session is kids locked', async () => {
      const h = await createHarness();
      try {
        const user = await h.makeUser();

        await expect(
          selectProfile(h.ctx, user.actor, user.profileId, { kidsLocked: true }),
        ).rejects.toMatchObject({ code: 'forbidden', message: 'kids_gate' });
      } finally {
        await h.drop();
      }
    });

    it('still lets a locked session switch to a kids profile, and an unlocked one switch freely', async () => {
      const h = await createHarness();
      try {
        const user = await h.makeUser();

        await expect(
          selectProfile(h.ctx, user.actor, user.kidsProfileId, { kidsLocked: true }),
        ).resolves.toMatchObject({ id: user.kidsProfileId });
        await expect(
          selectProfile(h.ctx, user.actor, user.profileId, { kidsLocked: false }),
        ).resolves.toMatchObject({ id: user.profileId });
        await expect(selectProfile(h.ctx, user.actor, user.profileId)).resolves.toMatchObject({
          id: user.profileId,
        });
      } finally {
        await h.drop();
      }
    });
  });

  describe('password confirmation is not an unlimited oracle', () => {
    it('spends a rate limit attempt for every password check when setting a PIN', async () => {
      const spent: string[] = [];
      const h = await createHarness({
        rateLimit: async (bucket) => {
          spent.push(bucket);
          return spent.length > 2
            ? { allowed: false, retryAfterSeconds: 60 }
            : { allowed: true, retryAfterSeconds: 0 };
        },
      });
      try {
        const user = await h.makeUser();
        const guess = (password: string) =>
          updateProfile(h.ctx, user.actor, user.profileId, { pin: '4821' }, { password });

        await expect(guess('wrong one')).rejects.toMatchObject({ message: 'password_required' });
        await expect(guess('wrong two')).rejects.toMatchObject({ message: 'password_required' });
        await expect(guess(TEST_PASSWORD)).rejects.toMatchObject({ code: 'rate_limited' });
      } finally {
        await h.drop();
      }
    });

    it('does not check the password at all once the limit is hit', async () => {
      let checks = 0;
      const h = await createHarness({
        rateLimit: async () => ({ allowed: false, retryAfterSeconds: 60 }),
        verifyPassword: async () => {
          checks += 1;
          return true;
        },
      });
      try {
        const user = await h.makeUser();

        await expect(
          updateProfile(
            h.ctx,
            user.actor,
            user.kidsProfileId,
            { isKids: false },
            { password: 'anything' },
          ),
        ).rejects.toMatchObject({ code: 'rate_limited' });
        expect(checks).toBe(0);
      } finally {
        await h.drop();
      }
    });

    it('shares one budget with leaving kids mode, so the two routes cannot double the guesses', async () => {
      const spent: string[] = [];
      const h = await createHarness({
        rateLimit: async (bucket, subject) => {
          spent.push(`${bucket}:${subject}`);
          return { allowed: true, retryAfterSeconds: 0 };
        },
      });
      try {
        const user = await h.makeUser();
        await exitKidsMode(h.ctx, user.actor, { password: TEST_PASSWORD });
        await updateProfile(
          h.ctx,
          user.actor,
          user.profileId,
          { pin: '4821' },
          { password: TEST_PASSWORD },
        );

        expect(spent).toEqual([`kids_exit:${user.accountId}`, `kids_exit:${user.accountId}`]);
      } finally {
        await h.drop();
      }
    });
  });
});
