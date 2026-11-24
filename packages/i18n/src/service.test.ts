import { describe, expect, it, vi } from 'vitest';
import { MemoryStore } from './store';
import { TranslationService, type AuditEvent } from './service';

const english = {
  'nav.home': 'Home',
  'nav.browse': 'Browse {name}',
  'player.play': 'Play',
} as never;

const editor = { accountId: 'e', role: 'editor' as const };
const admin = { accountId: 'a', role: 'admin' as const };
const superAdmin = { accountId: 's', role: 'super_admin' as const };

function make(minPercent = 80) {
  const audit: AuditEvent[] = [];
  let ui = ['en'];
  const store = new MemoryStore();
  const bump = vi.fn();
  const service = new TranslationService({
    store,
    english,
    baseline: () => ({}),
    audit: async (e) => void audit.push(e),
    settings: {
      uiLanguages: async () => ui,
      setUiLanguages: async (v) => void (ui = v),
      minPercent: async () => minPercent,
    },
    onChange: bump,
  });
  return { service, audit, store, bump, ui: () => ui };
}

describe('TranslationService', () => {
  it('save creates a draft with the English hash', async () => {
    const { service, store } = make();
    await service.save(editor, 'yo', 'nav.home', 'Ilé');
    const rows = await store.list('yo');
    expect(rows[0]).toMatchObject({ key: 'nav.home', status: 'draft', text: 'Ilé' });
    expect(rows[0]!.sourceHash).toBeTruthy();
  });
  it('an Editor can save but not approve', async () => {
    const { service } = make();
    await service.save(editor, 'yo', 'nav.home', 'Ilé');
    await expect(service.approve(editor, 'yo', 'nav.home')).rejects.toThrow(/permission|forbidden/i);
  });
  it('approve needs Admin and records reviewer and time', async () => {
    const { service, store } = make();
    await service.save(editor, 'yo', 'nav.home', 'Ilé');
    await service.approve(admin, 'yo', 'nav.home');
    const row = (await store.list('yo'))[0]!;
    expect(row.status).toBe('approved');
    expect(row.reviewedBy).toBe('a');
    expect(row.reviewedAt).toBeInstanceOf(Date);
  });
  it('approving a row with a validation error is refused', async () => {
    const { service, store } = make();
    await store.upsert('yo', { key: 'nav.browse', text: 'Wá', status: 'draft', sourceHash: null, updatedBy: 'e' });
    await expect(service.approve(admin, 'yo', 'nav.browse')).rejects.toThrow(/placeholder/);
  });
  it('save refuses invalid text with the validator message', async () => {
    const { service } = make();
    await expect(service.save(editor, 'yo', 'nav.browse', 'Wá')).rejects.toThrow(/placeholder/);
    await expect(service.save(editor, 'yo', 'nope.key', 'x')).rejects.toThrow(/unknown key/i);
    await expect(service.save(editor, 'en', 'nav.home', 'x')).rejects.toThrow(/locale/i);
  });
  it('bulk approve reports count and skips rows with errors', async () => {
    const { service, store } = make();
    await service.save(editor, 'yo', 'nav.home', 'Ilé');
    await store.upsert('yo', { key: 'nav.browse', text: 'Wá', status: 'draft', sourceHash: null, updatedBy: 'e' });
    const r = await service.approveMany(admin, 'yo', ['nav.home', 'nav.browse']);
    expect(r.approved).toBe(1);
    expect(r.skipped).toEqual([{ key: 'nav.browse', reason: expect.stringMatching(/placeholder/) }]);
  });
  it('publish is refused below the threshold', async () => {
    const { service } = make();
    await service.save(editor, 'yo', 'nav.home', 'Ilé');
    await service.approve(admin, 'yo', 'nav.home');
    await expect(service.publish(admin, 'yo')).rejects.toThrow(/threshold|percent/i);
  });
  it('publish works once the threshold is met and unpublish removes the locale', async () => {
    const { service, ui } = make(30);
    await service.save(editor, 'yo', 'nav.home', 'Ilé');
    await service.approve(admin, 'yo', 'nav.home');
    await service.publish(admin, 'yo');
    expect(ui()).toEqual(['en', 'yo']);
    await service.unpublish(admin, 'yo');
    expect(ui()).toEqual(['en']);
  });
  it('super admin override publishes below the threshold and is audited', async () => {
    const { service, audit, ui } = make();
    await expect(service.publish(admin, 'yo', { override: { reason: 'Demo day' } })).rejects.toThrow();
    await service.publish(superAdmin, 'yo', { override: { reason: 'Demo day' } });
    expect(ui()).toContain('yo');
    expect(audit.some((e) => e.action === 'i18n.translation.override_threshold' && e.extra?.reason === 'Demo day')).toBe(true);
  });
  it('an override needs a reason', async () => {
    const { service } = make();
    await expect(service.publish(superAdmin, 'yo', { override: { reason: ' ' } })).rejects.toThrow(/reason/i);
  });
  it('every write records an audit event and bumps the cache version', async () => {
    const { service, audit, bump } = make(0);
    await service.save(editor, 'yo', 'nav.home', 'Ilé');
    await service.approve(admin, 'yo', 'nav.home');
    await service.publish(admin, 'yo');
    expect(audit.map((e) => e.action)).toEqual([
      'i18n.translation.save',
      'i18n.translation.approve',
      'i18n.translation.publish_locale',
    ]);
    expect(bump).toHaveBeenCalledTimes(3);
  });
});
