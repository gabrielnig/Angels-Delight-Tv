import { saveProgress, addToMyList } from '@ad/viewer';
import {
  createHarness,
  integrationEnabled,
  NOW,
  seedSeries,
  seedVideo,
  type ViewerHarness,
} from '@ad/viewer/testing';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AccountViewerData, DEFAULT_PLAYBACK } from './real-account-data';

const SECRET = new Uint8Array(32).fill(5);

describe.skipIf(!integrationEnabled())('account viewer data', () => {
  let h: ViewerHarness;
  let data: AccountViewerData;
  const clock = { now: NOW };

  beforeAll(async () => {
    h = await createHarness();
    data = new AccountViewerData(h.ctx, { exportSecret: SECRET, now: () => clock.now });
  });
  afterAll(async () => {
    await h?.drop();
  });

  describe('stats', () => {
    it('counts what this account watched this month and saved across profiles', async () => {
      const u = await h.makeUser();
      const a = await seedVideo(h.db.setup, { durationMs: 600_000, kidsSafe: true });
      const b = await seedVideo(h.db.setup, { durationMs: 600_000 });
      h.setNow(NOW);
      await saveProgress(h.ctx, u.actor, {
        profileId: u.profileId,
        videoId: a.id,
        positionMs: 120_000,
        seek: true,
      });
      await saveProgress(h.ctx, u.actor, {
        profileId: u.profileId,
        videoId: b.id,
        positionMs: 180_000,
        seek: true,
      });
      await addToMyList(h.ctx, u.actor, {
        profileId: u.profileId,
        target: { kind: 'video', id: a.id },
      });
      await addToMyList(h.ctx, u.actor, {
        profileId: u.kidsProfileId,
        target: { kind: 'video', id: a.id },
      });
      const stats = await data.stats(u.accountId);
      expect(stats).toEqual({ watchedThisMonth: 2, minutesLearning: 5, myListCount: 2 });
    });

    it('does not count last month or another account', async () => {
      const u = await h.makeUser();
      const other = await h.makeUser();
      const v = await seedVideo(h.db.setup, { durationMs: 600_000 });
      h.setNow(new Date('2026-04-10T10:00:00Z'));
      await saveProgress(h.ctx, other.actor, {
        profileId: other.profileId,
        videoId: v.id,
        positionMs: 300_000,
        seek: true,
      });
      h.setNow(NOW);
      expect(await data.stats(u.accountId)).toEqual({
        watchedThisMonth: 0,
        minutesLearning: 0,
        myListCount: 0,
      });
      expect(await data.stats(other.accountId)).toMatchObject({ watchedThisMonth: 0 });
    });
  });

  describe('player preferences per profile (M03-S09)', () => {
    it('stores the caption language and keeps it with the other choices', async () => {
      const u = await h.makeUser();
      expect(DEFAULT_PLAYBACK.captionLanguage).toBe('en');
      const saved = await data.savePlayback(u.accountId, u.profileId, {
        captionLanguage: 'yo',
        speed: 1.5,
      });
      expect(saved).toMatchObject({ captionLanguage: 'yo', speed: 1.5 });
      await data.savePlayback(u.accountId, u.profileId, { dataSaver: true });
      expect(await data.playback(u.accountId, u.profileId)).toMatchObject({
        captionLanguage: 'yo',
        speed: 1.5,
        dataSaver: true,
      });
      await expect(
        data.savePlayback(u.accountId, u.profileId, { captionLanguage: 'not a code!' }),
      ).rejects.toThrow();
    });

    it('moves values saved on this device to the profile once, and only the listed fields', async () => {
      const u = await h.makeUser();
      const first = await data.migrateDevicePlayback(u.accountId, u.profileId, {
        speed: 1.25,
        captionsDefault: true,
        captionLanguage: 'ig',
        dataSaver: true,
        autoplayNext: false,
        quality: '4k' as never,
        volume: 0.2 as never,
      });
      expect(first).toMatchObject({
        speed: 1.25,
        captionsDefault: true,
        captionLanguage: 'ig',
        dataSaver: true,
        autoplayNext: false,
        quality: 'auto',
      });
      const second = await data.migrateDevicePlayback(u.accountId, u.profileId, { speed: 2 });
      expect(second.speed).toBe(1.25);
      await data.savePlayback(u.accountId, u.profileId, { speed: 0.75 });
      expect((await data.playback(u.accountId, u.profileId)).speed).toBe(0.75);
      const third = await data.migrateDevicePlayback(u.accountId, u.profileId, { speed: 2 });
      expect(third.speed).toBe(0.75);
    });

    it('does not migrate into another account profile', async () => {
      const u = await h.makeUser();
      const other = await h.makeUser();
      await expect(
        data.migrateDevicePlayback(u.accountId, other.profileId, { speed: 2 }),
      ).rejects.toThrow();
    });
  });

  describe('playback settings', () => {
    it('returns defaults, then saves a merged patch', async () => {
      const u = await h.makeUser();
      expect(await data.playback(u.accountId, u.profileId)).toEqual(DEFAULT_PLAYBACK);
      const saved = await data.savePlayback(u.accountId, u.profileId, {
        quality: '480',
        autoplayNext: false,
      });
      expect(saved).toEqual({ ...DEFAULT_PLAYBACK, quality: '480', autoplayNext: false });
      const again = await data.savePlayback(u.accountId, u.profileId, {
        captionSize: 'large',
        dataSaver: true,
      });
      expect(again).toEqual({ ...saved, captionSize: 'large', dataSaver: true });
      expect(await data.playback(u.accountId, u.profileId)).toEqual(again);
    });

    it('keeps settings per profile', async () => {
      const u = await h.makeUser();
      await data.savePlayback(u.accountId, u.profileId, { quality: '360' });
      expect((await data.playback(u.accountId, u.kidsProfileId)).quality).toBe('auto');
    });

    it('saves and reads captionEdge, and defaults it to shadow', async () => {
      const u = await h.makeUser();
      expect((await data.playback(u.accountId, u.profileId)).captionEdge).toBe('shadow');
      const saved = await data.savePlayback(u.accountId, u.profileId, { captionEdge: 'outline' });
      expect(saved.captionEdge).toBe('outline');
      expect((await data.playback(u.accountId, u.profileId)).captionEdge).toBe('outline');
    });

    it('rejects an unknown edge', async () => {
      const u = await h.makeUser();
      await expect(
        data.savePlayback(u.accountId, u.profileId, { captionEdge: 'glow' as never }),
      ).rejects.toThrow();
    });

    it('rejects values outside the allowed sets', async () => {
      const u = await h.makeUser();
      await expect(
        data.savePlayback(u.accountId, u.profileId, { quality: '4k' as never }),
      ).rejects.toThrow();
      await expect(data.savePlayback(u.accountId, u.profileId, { speed: 9 })).rejects.toThrow();
    });

    it('refuses a profile of another account', async () => {
      const u = await h.makeUser();
      const other = await h.makeUser();
      await expect(data.playback(u.accountId, other.profileId)).rejects.toThrow();
      await expect(
        data.savePlayback(u.accountId, other.profileId, { quality: '720' }),
      ).rejects.toThrow();
    });
  });

  describe('data export', () => {
    it('contains account, profiles, list items and progress, and no secrets', async () => {
      const u = await h.makeUser();
      const v = await seedVideo(h.db.setup, { title: 'Export me', durationMs: 600_000 });
      const s = await seedSeries(h.db.setup, { series: { title: 'Export series' } });
      await saveProgress(h.ctx, u.actor, {
        profileId: u.profileId,
        videoId: v.id,
        positionMs: 60_000,
        seek: true,
      });
      await addToMyList(h.ctx, u.actor, {
        profileId: u.profileId,
        target: { kind: 'video', id: v.id },
      });
      await addToMyList(h.ctx, u.actor, {
        profileId: u.profileId,
        target: { kind: 'series', id: s.id },
      });
      const file = await data.buildExport(u.accountId, {
        email: 'ada@example.com',
        memberSince: '2026-03-03T00:00:00.000Z',
      });
      expect(file.account).toEqual({
        email: 'ada@example.com',
        memberSince: '2026-03-03T00:00:00.000Z',
      });
      expect(file.exportedAt).toBe(NOW.toISOString());
      expect(file.profiles.map((p) => p.name)).toEqual(['Grown up', 'Little one']);
      const adult = file.profiles[0]!;
      expect(adult.myList.map((i) => i.title).sort()).toEqual(['Export me', 'Export series']);
      expect(adult.progress).toEqual([
        expect.objectContaining({
          title: 'Export me',
          positionSeconds: 60,
          durationSeconds: 600,
          completed: false,
        }),
      ]);
      const text = JSON.stringify(file);
      expect(text).not.toMatch(/password|hash|token/i);
    });

    it('exports a small file for a new account', async () => {
      const u = await h.makeUser();
      const file = await data.buildExport(u.accountId, {
        email: 'new@example.com',
        memberSince: '2026-06-01T00:00:00.000Z',
      });
      expect(file.profiles).toHaveLength(2);
      expect(file.profiles[0]!.myList).toEqual([]);
      expect(file.profiles[0]!.progress).toEqual([]);
    });

    it('signs a short lived download token bound to the account', async () => {
      const token = data.signExportToken('acct-1');
      expect(data.verifyExportToken(token)).toBe('acct-1');
      expect(data.verifyExportToken(token + 'x')).toBeNull();
      expect(data.verifyExportToken('garbage')).toBeNull();
      clock.now = new Date(NOW.getTime() + 11 * 60_000);
      expect(data.verifyExportToken(token)).toBeNull();
      clock.now = NOW;
      const other = new AccountViewerData(h.ctx, {
        exportSecret: new Uint8Array(32).fill(6),
        now: () => NOW,
      });
      expect(other.verifyExportToken(token)).toBeNull();
    });

    it('signs a token that lasts until the given expiry, for the 24 hour email link', async () => {
      const token = data.signExportToken('acct-1', new Date(NOW.getTime() + 24 * 3600_000));
      clock.now = new Date(NOW.getTime() + 23 * 3600_000);
      expect(data.verifyExportToken(token)).toBe('acct-1');
      clock.now = new Date(NOW.getTime() + 25 * 3600_000);
      expect(data.verifyExportToken(token)).toBeNull();
      clock.now = NOW;
    });
  });
});
