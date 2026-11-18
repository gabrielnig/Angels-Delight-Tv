import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
const { noticesAdmin, resetNoticeFixture } = await import('./notices');

const admin = { accountId: 'a1', name: 'A', role: 'admin' } as const;
const other = { accountId: 'a2', name: 'B', role: 'editor' } as const;
const viewer = { accountId: 'v1', name: 'V', role: 'viewer' } as const;

describe('notices fixture', () => {
  beforeEach(() => resetNoticeFixture());

  it('counts unread, clears them on mark all read, and keeps the notices', async () => {
    const before = await noticesAdmin.feed(admin);
    expect(before.unread).toBeGreaterThan(0);
    await noticesAdmin.markAllRead(admin);
    const after = await noticesAdmin.feed(admin);
    expect(after.unread).toBe(0);
    expect(after.items).toHaveLength(before.items.length);
  });

  it('defaults to failures only and saves per person', async () => {
    expect(await noticesAdmin.prefs(admin)).toEqual({
      failures: true,
      captionsReady: false,
      dailySummary: false,
      emailFrequency: 'hourly',
    });
    await noticesAdmin.setPrefs(admin, { captionsReady: true });
    expect((await noticesAdmin.prefs(admin)).captionsReady).toBe(true);
    expect((await noticesAdmin.prefs(other)).captionsReady).toBe(false);
  });

  it('saves how often email arrives and refuses a value it does not know', async () => {
    const saved = await noticesAdmin.setPrefs(admin, { emailFrequency: 'immediate' });
    expect(saved).toMatchObject({ ok: true, prefs: { emailFrequency: 'immediate' } });
    expect((await noticesAdmin.prefs(other)).emailFrequency).toBe('hourly');
    const bad = await noticesAdmin.setPrefs(admin, { emailFrequency: 'weekly' as never });
    expect(bad).toMatchObject({ ok: false });
    expect((await noticesAdmin.prefs(admin)).emailFrequency).toBe('immediate');
  });

  it('refuses a viewer', async () => {
    await expect(noticesAdmin.feed(viewer)).rejects.toThrow();
    await expect(noticesAdmin.setPrefs(viewer, { failures: false })).rejects.toThrow();
  });
});
