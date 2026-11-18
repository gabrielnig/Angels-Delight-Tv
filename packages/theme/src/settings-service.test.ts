import { describe, expect, it, vi } from 'vitest';
import { Forbidden, NotFound, ValidationFailed, type Actor } from '@ad/shared';
import { SettingsService, SETTINGS_ACTIONS } from './settings-service';
import { defaultSettings } from './settings-registry';
import { MemorySettingsStore } from './testing';

const admin = { accountId: '0198c000-0000-7000-8000-000000000001', role: 'admin' as const };
const editor = { accountId: '0198c000-0000-7000-8000-000000000002', role: 'editor' as const };
const superAdmin = {
  accountId: '0198c000-0000-7000-8000-000000000003',
  role: 'super_admin' as const,
};
const logger = () => ({
  error: vi.fn(),
  warn: vi.fn(),
  info: vi.fn(),
  debug: vi.fn(),
  child: vi.fn(),
});

function setup(options: { now?: () => number; isSuper?: (actor: Actor) => boolean } = {}) {
  const store = new MemorySettingsStore();
  const log = logger();
  const service = new SettingsService({ store, logger: log, ...options });
  return { store, service, log };
}

describe('reading', () => {
  it('returns defaults for an empty table', async () => {
    const { service } = setup();
    expect(await service.getAll()).toEqual(defaultSettings());
    expect(await service.get('limits.max_profiles')).toBe(5);
  });

  it('reads stored values and ignores unknown keys', async () => {
    const { service, store } = setup();
    store.rows.set('limits.max_profiles', {
      key: 'limits.max_profiles',
      value: 3,
      isPublic: false,
      description: null,
      updatedBy: null,
      updatedAt: new Date(),
    });
    store.rows.set('mystery.key', {
      key: 'mystery.key',
      value: 'x',
      isPublic: true,
      description: null,
      updatedBy: null,
      updatedAt: new Date(),
    });
    const all = await service.getAll();
    expect(all['limits.max_profiles']).toBe(3);
    expect(all).not.toHaveProperty('mystery.key');
  });

  it('falls back to the default for an invalid stored value and logs it', async () => {
    const { service, store, log } = setup();
    store.rows.set('limits.max_profiles', {
      key: 'limits.max_profiles',
      value: 'lots',
      isPublic: false,
      description: null,
      updatedBy: null,
      updatedAt: new Date(),
    });
    expect(await service.get('limits.max_profiles')).toBe(5);
    expect(log.warn).toHaveBeenCalled();
  });

  it('falls back to the compiled defaults when the read fails (M29-S02 error)', async () => {
    const { service, store, log } = setup();
    store.failReads = true;
    expect(await service.getAll()).toEqual(defaultSettings());
    expect(log.error).toHaveBeenCalled();
  });

  it('caches for 60 seconds, and a write busts the cache', async () => {
    let now = 1_000;
    const { service, store } = setup({ now: () => now });
    await service.getAll();
    await service.getAll();
    expect(store.readAllCalls).toBe(1);
    now += 61_000;
    await service.getAll();
    expect(store.readAllCalls).toBe(2);
    await service.update(admin, { 'platform.tagline': 'Hello' });
    expect(await service.get('platform.tagline')).toBe('Hello');
  });

  it('public settings contain only public keys', async () => {
    const { service } = setup();
    const pub = await service.getPublic();
    expect(pub['platform.name']).toBe('Angels Delight TV');
    expect(pub).not.toHaveProperty('limits.max_profiles');
    expect(pub).not.toHaveProperty('platform.canonical_host');
  });
});

describe('update', () => {
  it('saves changed values with the registry is_public flag and audits old and new values', async () => {
    const { service, store } = setup();
    await service.update(superAdmin, { 'platform.name': 'Sister V TV', 'limits.max_profiles': 4 });
    expect(store.rows.get('platform.name')).toMatchObject({
      value: 'Sister V TV',
      isPublic: true,
      updatedBy: superAdmin.accountId,
    });
    expect(store.rows.get('limits.max_profiles')).toMatchObject({ value: 4, isPublic: false });
    const entry = store.audit.entries.at(-1)!;
    expect(entry.action).toBe(SETTINGS_ACTIONS.changed);
    expect(entry.metadata.changes).toEqual([
      { key: 'platform.name', old: 'Angels Delight TV', new: 'Sister V TV' },
      { key: 'limits.max_profiles', old: 5, new: 4 },
    ]);
  });

  it('does nothing and writes no audit entry when nothing changed', async () => {
    const { service, store } = setup();
    await service.update(superAdmin, { 'limits.max_profiles': 5 });
    expect(store.rows.size).toBe(0);
    expect(store.audit.entries).toHaveLength(0);
  });

  it('rejects the whole update with per key messages and saves nothing', async () => {
    const { service, store } = setup();
    const error = (await service
      .update(superAdmin, {
        'platform.name': 'Fine',
        'limits.max_sessions': 11,
        'platform.support_email': 'nope',
      })
      .catch((e: unknown) => e)) as ValidationFailed;
    expect(error).toBeInstanceOf(ValidationFailed);
    expect(Object.keys(error.fields).sort()).toEqual([
      'limits.max_sessions',
      'platform.support_email',
    ]);
    expect(error.fields['limits.max_sessions']![0]).toMatch(/10/);
    expect(store.rows.size).toBe(0);
  });

  it('rejects unknown keys', async () => {
    const { service } = setup();
    await expect(service.update(admin, { 'platform.secret': 1 } as never)).rejects.toBeInstanceOf(
      ValidationFailed,
    );
    await expect(
      service.update(admin, JSON.parse('{"__proto__": 1, "constructor": 2}') as never),
    ).rejects.toBeInstanceOf(ValidationFailed);
  });

  it('refuses editors and viewers', async () => {
    const { service } = setup();
    await expect(service.update(editor, { 'platform.name': 'x' })).rejects.toBeInstanceOf(
      Forbidden,
    );
    await expect(service.listFields(editor)).rejects.toBeInstanceOf(Forbidden);
  });

  it('keeps super tier keys behind the super check', async () => {
    const { service, store } = setup({ isSuper: () => false });
    await expect(service.update(admin, { 'features.signups_open': false })).rejects.toBeInstanceOf(
      Forbidden,
    );
    await service.update(admin, { 'platform.tagline': 'ok' });
    expect(store.rows.has('platform.tagline')).toBe(true);
  });

  it('by default only a Super admin may change features and limits (M29-S02, D-125)', async () => {
    const { service, store } = setup();
    await expect(service.update(admin, { 'limits.max_profiles': 3 })).rejects.toBeInstanceOf(
      Forbidden,
    );
    expect(store.rows.has('limits.max_profiles')).toBe(false);
    await service.update(superAdmin, { 'limits.max_profiles': 3 });
    expect(store.rows.get('limits.max_profiles')?.value).toBe(3);
    await service.update(admin, { 'platform.tagline': 'ok' });
    expect(store.rows.has('platform.tagline')).toBe(true);
  });

  it('refuses an unknown role even when it looks high', async () => {
    const { service } = setup();
    const forged = { ...admin, role: 'owner' as never };
    await expect(service.update(forged, { 'platform.tagline': 'x' })).rejects.toBeInstanceOf(
      Forbidden,
    );
  });

  it('returns the resolved settings after saving', async () => {
    const { service } = setup();
    const result = await service.update(superAdmin, { 'features.autoplay_hero': true });
    expect(result['features.autoplay_hero']).toBe(true);
  });
});

describe('admin form view', () => {
  it('lists every field with value, default, label and tier', async () => {
    const { service } = setup();
    const fields = await service.listFields(admin);
    const profile = fields.find((field) => field.key === 'limits.max_profiles')!;
    expect(profile).toMatchObject({
      value: 5,
      default: 5,
      label: 'Profiles per account',
      tier: 'super',
      group: 'limits',
    });
  });
});

describe('launch checklist', () => {
  it('flags unset items and placeholder pages', async () => {
    const { service } = setup();
    const checklist = await service.launchChecklist(admin);
    const byId = Object.fromEntries(checklist.map((item) => [item.id, item]));
    expect(byId.name_tagline!.done).toBe(false);
    expect(byId.support_email!.done).toBe(false);
    expect(byId.terms!.done).toBe(false);
    expect(byId.privacy!.done).toBe(false);
    expect(byId.domain!.done).toBe(false);
  });

  it('ticks items as they are filled in', async () => {
    const { service } = setup();
    await service.update(admin, {
      'platform.tagline': 'Short lessons',
      'platform.support_email': 'help@angelsdelight.tv',
      'platform.canonical_host': 'angelsdelight.tv',
    });
    await service.savePageDraft(admin, 'terms', '<p>Real terms.</p>');
    await service.publishPage(admin, 'terms');
    const byId = Object.fromEntries(
      (await service.launchChecklist(admin)).map((item) => [item.id, item]),
    );
    expect(byId.name_tagline!.done).toBe(true);
    expect(byId.support_email!.done).toBe(true);
    expect(byId.domain!.done).toBe(true);
    expect(byId.terms!.done).toBe(true);
    expect(byId.privacy!.done).toBe(false);
  });
});

describe('pages (M26-S02)', () => {
  it('starts with placeholder text as the draft', async () => {
    const { service } = setup();
    const page = await service.getPage(admin, 'terms');
    expect(page.published).toBeNull();
    expect(page.draftBody).toContain('[Add your terms of use here before launch]');
    expect(page.isPlaceholder).toBe(true);
    expect(page.versions).toEqual([]);
  });

  it('sanitises on save and keeps only a draft until published', async () => {
    const { service } = setup();
    const draft = await service.savePageDraft(
      admin,
      'privacy',
      '<h2>Privacy</h2><script>alert(1)</script><p onclick="x">We keep little data.</p>',
    );
    expect(draft.draftBody).toBe('<h2>Privacy</h2><p>We keep little data.</p>');
    expect(await service.getPublishedPage('privacy')).toBeNull();
  });

  it('publishes versions with increasing numbers, newest first, and updates the legal version setting', async () => {
    const { service } = setup();
    await service.savePageDraft(admin, 'terms', '<p>One</p>');
    const v1 = await service.publishPage(admin, 'terms');
    await service.savePageDraft(admin, 'terms', '<p>Two</p>');
    const v2 = await service.publishPage(admin, 'terms');
    expect([v1.published!.version, v2.published!.version]).toEqual([1, 2]);
    expect(v2.versions.map((version) => version.version)).toEqual([2, 1]);
    expect(await service.get('legal.terms_version')).toBe('v2');
    expect(await service.get('legal.privacy_version')).toBe('v0');
    const viewer = await service.getPublishedPage('terms');
    expect(viewer).toMatchObject({
      slug: 'terms',
      title: 'Terms of use',
      html: '<p>Two</p>',
      version: 2,
    });
  });

  it('does not bump a legal version for about or help', async () => {
    const { service } = setup();
    await service.savePageDraft(admin, 'about', '<p>About us</p>');
    await service.publishPage(admin, 'about');
    expect(await service.get('legal.terms_version')).toBe('v0');
    expect((await service.getPublishedPage('about'))!.title).toBe('About');
  });

  it('refuses to publish without a draft, or an empty or placeholder draft', async () => {
    const { service } = setup();
    await expect(service.publishPage(admin, 'terms')).rejects.toBeInstanceOf(NotFound);
    await service.savePageDraft(
      admin,
      'terms',
      '<p>[Add your terms of use here before launch]</p>',
    );
    await expect(service.publishPage(admin, 'terms')).rejects.toBeInstanceOf(ValidationFailed);
  });

  it('restores an earlier version into the draft without publishing', async () => {
    const { service } = setup();
    await service.savePageDraft(admin, 'help', '<p>First</p>');
    await service.publishPage(admin, 'help');
    await service.savePageDraft(admin, 'help', '<p>Second</p>');
    await service.publishPage(admin, 'help');
    const restored = await service.restorePageVersion(admin, 'help', 1);
    expect(restored.draftBody).toBe('<p>First</p>');
    expect(restored.published!.version).toBe(2);
    await expect(service.restorePageVersion(admin, 'help', 9)).rejects.toBeInstanceOf(NotFound);
  });

  it('rejects unknown page slugs', async () => {
    const { service } = setup();
    await expect(service.getPage(admin, 'secrets' as never)).rejects.toBeInstanceOf(NotFound);
    expect(await service.getPublishedPage('secrets' as never)).toBeNull();
  });

  it('rejects oversized bodies', async () => {
    const { service } = setup();
    await expect(
      service.savePageDraft(admin, 'terms', '<p>' + 'a'.repeat(200_001) + '</p>'),
    ).rejects.toBeInstanceOf(ValidationFailed);
  });

  it('audits publish and restore', async () => {
    const { service, store } = setup();
    await service.savePageDraft(admin, 'terms', '<p>A</p>');
    await service.publishPage(admin, 'terms');
    await service.restorePageVersion(admin, 'terms', 1);
    const actions = store.audit.entries.map((entry) => entry.action);
    expect(actions).toContain(SETTINGS_ACTIONS.pagePublished);
    expect(actions).toContain(SETTINGS_ACTIONS.pageRestored);
  });

  it('refuses editors', async () => {
    const { service } = setup();
    await expect(service.savePageDraft(editor, 'terms', '<p>x</p>')).rejects.toBeInstanceOf(
      Forbidden,
    );
    await expect(service.publishPage(editor, 'terms')).rejects.toBeInstanceOf(Forbidden);
  });

  it('caps stored versions at 50', async () => {
    const { service } = setup();
    for (let i = 1; i <= 52; i += 1) {
      await service.savePageDraft(admin, 'help', `<p>v${i}</p>`);
      await service.publishPage(admin, 'help');
    }
    const page = await service.getPage(admin, 'help');
    expect(page.versions).toHaveLength(50);
    expect(page.versions[0]!.version).toBe(52);
  });
});
