import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const { siteSettingsAdmin } = await import('./site-settings');

const superAdmin = { accountId: 'acc_super', role: 'super_admin' as const, name: 'Arkdev' };
const admin = { accountId: 'acc_admin', role: 'admin' as const, name: 'Chiamaka Okafor' };
const editor = { accountId: 'acc_editor', role: 'editor' as const, name: 'Ngozi Eze' };

beforeEach(() => {
  delete (globalThis as unknown as Record<symbol, unknown>)[Symbol.for('ad.theme.runtime')];
});

describe('siteSettingsAdmin (fixture runtime)', () => {
  it('loads defaults, an unticked checklist and placeholder pages', async () => {
    const result = await siteSettingsAdmin.load(admin);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.values['platform.name']).toBe('Angels Delight TV');
    expect(result.data.values['limits.max_profiles']).toBe(5);
    expect(result.data.checklist.filter((item) => !item.done)).toHaveLength(5);
    expect(result.data.pages.terms.isPlaceholder).toBe(true);
    expect(Object.keys(result.data.pages)).toEqual(['terms', 'privacy', 'about', 'help']);
  });

  it('refuses an editor', async () => {
    expect(await siteSettingsAdmin.load(editor)).toEqual({
      ok: false,
      message: 'You do not have access to site settings',
    });
    expect(await siteSettingsAdmin.update(editor, { 'platform.name': 'x' })).toMatchObject({
      ok: false,
    });
    expect(await siteSettingsAdmin.publishPage(editor, 'terms')).toMatchObject({ ok: false });
  });

  it('saves settings and returns the refreshed view with the checklist ticked', async () => {
    const result = await siteSettingsAdmin.update(admin, {
      'platform.tagline': 'Short lessons',
      'platform.support_email': 'help@angelsdelight.tv',
    });
    expect(result.ok && result.data.values['platform.tagline']).toBe('Short lessons');
    expect(
      result.ok && result.data.checklist.find((item) => item.id === 'support_email')!.done,
    ).toBe(true);
  });

  it('keeps Features and limits for a Super admin (M29-S02, D-128)', async () => {
    const asAdmin = await siteSettingsAdmin.load(admin);
    const asSuper = await siteSettingsAdmin.load(superAdmin);
    expect(asAdmin.ok && asAdmin.data.canChangeFlags).toBe(false);
    expect(asSuper.ok && asSuper.data.canChangeFlags).toBe(true);
    expect(await siteSettingsAdmin.update(admin, { 'limits.max_profiles': 3 })).toMatchObject({
      ok: false,
    });
    const saved = await siteSettingsAdmin.update(superAdmin, { 'limits.max_profiles': 3 });
    expect(saved.ok && saved.data.values['limits.max_profiles']).toBe(3);
    const after = await siteSettingsAdmin.load(admin);
    expect(after.ok && after.data.values['limits.max_profiles']).toBe(3);
  });

  it('returns a message per invalid key', async () => {
    const result = await siteSettingsAdmin.update(superAdmin, {
      'limits.max_sessions': 11,
      'platform.support_email': 'nope',
    });
    expect(result).toMatchObject({
      ok: false,
      fields: {
        'limits.max_sessions': expect.any(Array),
        'platform.support_email': expect.any(Array),
      },
    });
  });

  it('runs the page flow: draft, publish, restore', async () => {
    const draft = await siteSettingsAdmin.savePage(
      admin,
      'terms',
      '<p>First.</p><script>x</script>',
    );
    expect(draft.ok && draft.data.draftBody).toBe('<p>First.</p>');
    const published = await siteSettingsAdmin.publishPage(admin, 'terms');
    expect(published.ok && published.data.pages.terms.published?.version).toBe(1);
    expect(published.ok && published.data.values['legal.terms_version']).toBe('v1');
    await siteSettingsAdmin.savePage(admin, 'terms', '<p>Second.</p>');
    await siteSettingsAdmin.publishPage(admin, 'terms');
    const restored = await siteSettingsAdmin.restorePage(admin, 'terms', 1);
    expect(restored.ok && restored.data.draftBody).toBe('<p>First.</p>');
    expect(await siteSettingsAdmin.restorePage(admin, 'terms', 9)).toMatchObject({ ok: false });
  });

  it('refuses to publish placeholder text', async () => {
    const result = await siteSettingsAdmin.publishPage(admin, 'privacy');
    expect(result.ok).toBe(false);
  });
});
