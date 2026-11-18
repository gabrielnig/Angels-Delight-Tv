import {
  createHarness,
  integrationEnabled,
  TEST_PASSWORD,
  type ViewerHarness,
} from '@ad/viewer/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { RealProfiles, type ProfileIo } from './real-profiles';

describe.skipIf(!integrationEnabled())('real profiles repository', () => {
  let h: ViewerHarness;
  let active: string | null;
  const calls: string[] = [];
  const io: ProfileIo = {
    activeProfileId: async () => active,
    kidsLocked: async () => false,
    clearLock: async () => undefined,
    setActive: async (_account, id) => {
      calls.push(`set:${id}`);
      active = id;
    },
    clearActive: async () => {
      calls.push('clear');
      active = null;
    },
  };
  const repo = () => new RealProfiles(h.ctx, io);

  beforeAll(async () => {
    h = await createHarness();
  });
  afterAll(async () => {
    await h?.drop();
  });

  it('lists decrypted profiles with the active one marked', async () => {
    const user = await h.makeUser();
    active = user.kidsProfileId;
    const list = await repo().list(user.accountId);
    expect(list.map((p) => [p.name, p.kids, p.owner])).toEqual([
      ['Grown up', false, true],
      ['Little one', true, false],
    ]);
    expect(list.find((p) => p.lastUsedHere)?.id).toBe(user.kidsProfileId);
  });

  it('answers null for a profile of another account', async () => {
    const mine = await h.makeUser();
    const other = await h.makeUser();
    expect(await repo().get(mine.accountId, other.profileId)).toBeNull();
    expect((await repo().get(mine.accountId, mine.profileId))?.name).toBe('Grown up');
  });

  it('creates a profile with an avatar from the tone and rejects duplicates', async () => {
    const user = await h.makeUser();
    active = user.profileId;
    const made = await repo().create(user.accountId, { name: 'Emeka', kids: false, tone: 'peach' });
    expect(made).toMatchObject({
      ok: true,
      profile: { name: 'Emeka', tone: 'peach', kids: false },
    });
    const again = await repo().create(user.accountId, { name: 'emeka', kids: false });
    expect(again).toEqual({ ok: false, reason: 'duplicate' });
  });

  it('reports the profile limit', async () => {
    const user = await h.makeUser();
    active = user.profileId;
    for (const name of ['A', 'B', 'C']) {
      expect((await repo().create(user.accountId, { name, kids: false })).ok).toBe(true);
    }
    expect(await repo().create(user.accountId, { name: 'D', kids: false })).toEqual({
      ok: false,
      reason: 'limit',
    });
  });

  it('keeps a kids profile from managing profiles', async () => {
    const user = await h.makeUser();
    active = user.kidsProfileId;
    const result = await repo().create(user.accountId, { name: 'Sneaky', kids: false });
    expect(result.ok).toBe(false);
  });

  it('needs the password to leave kids mode and blocks the last adult from becoming kids', async () => {
    const user = await h.makeUser();
    active = user.profileId;
    expect(await repo().update(user.accountId, user.kidsProfileId, { kids: false })).toEqual({
      ok: false,
      reason: 'password_required',
    });
    expect(
      await repo().update(user.accountId, user.kidsProfileId, { kids: false, password: 'wrong' }),
    ).toEqual({ ok: false, reason: 'password_required' });
    const ok = await repo().update(user.accountId, user.kidsProfileId, {
      kids: false,
      password: TEST_PASSWORD,
    });
    expect(ok).toMatchObject({ ok: true, profile: { kids: false } });

    const solo = await h.makeUser();
    active = solo.profileId;
    expect(await repo().update(solo.accountId, solo.profileId, { kids: true })).toEqual({
      ok: false,
      reason: 'last_adult',
    });
  });

  it('updates playback preferences on the profile', async () => {
    const user = await h.makeUser();
    active = user.profileId;
    const result = await repo().update(user.accountId, user.profileId, { autoplayNext: false });
    expect(result).toMatchObject({ ok: true, profile: { autoplayNext: false } });
  });

  it('refuses to delete the last adult and removes others', async () => {
    const user = await h.makeUser();
    active = user.profileId;
    expect(await repo().remove(user.accountId, user.profileId)).toEqual({
      ok: false,
      reason: 'last_adult',
    });
    expect(await repo().remove(user.accountId, user.kidsProfileId)).toEqual({ ok: true });
    expect(await repo().list(user.accountId)).toHaveLength(1);
  });

  it('selects an owned profile through the io and refuses a foreign one', async () => {
    const user = await h.makeUser();
    const other = await h.makeUser();
    calls.length = 0;
    await repo().select(user.accountId, user.kidsProfileId);
    expect(calls).toEqual([`set:${user.kidsProfileId}`]);
    await expect(repo().select(user.accountId, other.profileId)).rejects.toThrow();
    expect(calls).toHaveLength(1);
  });

  it('asks for the PIN of a protected profile, counts a wrong one and accepts the right PIN or the password', async () => {
    const user = await h.makeUser();
    active = user.profileId;
    await repo().update(user.accountId, user.profileId, { pin: '4821', password: TEST_PASSWORD });
    expect((await repo().list(user.accountId)).find((p) => p.id === user.profileId)?.hasPin).toBe(
      true,
    );
    active = null;
    calls.length = 0;
    expect(await repo().select(user.accountId, user.profileId)).toEqual({
      ok: false,
      reason: 'pin_required',
    });
    expect(await repo().select(user.accountId, user.profileId, { pin: '0000' })).toEqual({
      ok: false,
      reason: 'pin_invalid',
    });
    expect(calls).toEqual([]);
    expect(await repo().select(user.accountId, user.profileId, { pin: '4821' })).toEqual({
      ok: true,
    });
    expect(calls).toEqual([`set:${user.profileId}`]);
    expect(
      await repo().select(user.accountId, user.profileId, { password: 'wrong-password' }),
    ).toEqual({ ok: false, reason: 'password_incorrect' });
    expect(
      await repo().select(user.accountId, user.profileId, { password: TEST_PASSWORD }),
    ).toEqual({ ok: true });
  });

  it('removes a PIN with the account password', async () => {
    const user = await h.makeUser();
    active = user.profileId;
    await repo().update(user.accountId, user.profileId, { pin: '4821', password: TEST_PASSWORD });
    await repo().update(user.accountId, user.profileId, { pin: null, password: TEST_PASSWORD });
    expect((await repo().list(user.accountId)).find((p) => p.id === user.profileId)?.hasPin).toBe(
      false,
    );
  });

  it('clears the active cookie when the active profile is deleted', async () => {
    const user = await h.makeUser();
    active = user.kidsProfileId;
    calls.length = 0;
    // A kids profile cannot manage, so the grown-up deletes it from its own session.
    active = user.profileId;
    await repo().remove(user.accountId, user.kidsProfileId);
    expect(calls).not.toContain('clear');
    await repo().create(user.accountId, { name: 'Third', kids: false });
    const third = (await repo().list(user.accountId)).find((p) => p.name === 'Third')!;
    active = third.id;
    calls.length = 0;
    await repo().remove(user.accountId, third.id);
    expect(calls).toEqual(['clear']);
  });
});
