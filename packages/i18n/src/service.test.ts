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

describe('TranslationService tab label cap (L12)', () => {
  it('saves a tab label over 12 characters and returns the length warning', async () => {
    const { service, store } = make();
    const result = await service.save(editor, 'yo', 'nav.home', 'Ilé ìkínni tó gùn jù');
    expect(result.warnings).toContain(
      'is over 12 characters, so the tab bar will cut it with an ellipsis',
    );
    expect((await store.list('yo'))[0]).toMatchObject({ key: 'nav.home', status: 'draft' });
  });

  it('gives no tab warning to a short tab label or to another key', async () => {
    const { service } = make();
    expect((await service.save(editor, 'yo', 'nav.home', 'Ilé')).warnings).toEqual([]);
    expect(
      (await service.save(editor, 'yo', 'player.play', 'Ṣe ere ní ọ̀nà tó gùn jù lọ')).warnings,
    ).not.toContain('is over 12 characters, so the tab bar will cut it with an ellipsis');
  });
});

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
    await expect(service.approve(editor, 'yo', 'nav.home')).rejects.toThrow(
      /permission|forbidden/i,
    );
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
    await store.upsert('yo', {
      key: 'nav.browse',
      text: 'Wá',
      status: 'draft',
      sourceHash: null,
      updatedBy: 'e',
    });
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
    await store.upsert('yo', {
      key: 'nav.browse',
      text: 'Wá',
      status: 'draft',
      sourceHash: null,
      updatedBy: 'e',
    });
    const r = await service.approveMany(admin, 'yo', ['nav.home', 'nav.browse']);
    expect(r.approved).toBe(1);
    expect(r.skipped).toEqual([
      { key: 'nav.browse', reason: expect.stringMatching(/placeholder/) },
    ]);
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
    await expect(
      service.publish(admin, 'yo', { override: { reason: 'Demo day' } }),
    ).rejects.toThrow();
    await service.publish(superAdmin, 'yo', { override: { reason: 'Demo day' } });
    expect(ui()).toContain('yo');
    expect(
      audit.some(
        (e) => e.action === 'i18n.translation.override_threshold' && e.extra?.reason === 'Demo day',
      ),
    ).toBe(true);
  });
  it('an override needs a reason', async () => {
    const { service } = make();
    await expect(service.publish(superAdmin, 'yo', { override: { reason: ' ' } })).rejects.toThrow(
      /reason/i,
    );
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

  it('Editors can import drafts, a dry run writes nothing and viewers are refused', async () => {
    const { service, store, audit } = make();
    const csv = 'key,translation\nnav.home,Ilé\nnav.nope,x\n';
    const dry = await service.importCsv(editor, 'yo', csv, { dryRun: true });
    expect(dry.added).toHaveLength(1);
    expect(dry.rejected).toHaveLength(1);
    expect(await store.list('yo')).toHaveLength(0);
    expect(audit).toHaveLength(0);
    await service.importCsv(editor, 'yo', csv);
    expect((await store.list('yo'))[0]).toMatchObject({ key: 'nav.home', status: 'in_review' });
    expect(audit.map((e) => e.action)).toEqual(['i18n.translation.import']);
    await expect(service.importCsv({ accountId: 'v', role: 'viewer' }, 'yo', csv)).rejects.toThrow(
      /permission/,
    );
  });

  it('exports csv and json for a locale', async () => {
    const { service } = make();
    await service.save(editor, 'yo', 'nav.home', 'Ilé');
    expect(await service.exportCsv(editor, 'yo')).toContain('Ilé');
    expect(JSON.parse(await service.exportJson(editor, 'yo'))).toEqual({});
  });
});

describe('loadDrafts (sample drafts pending native review)', () => {
  const drafts = (locale: string) =>
    locale === 'yo'
      ? ({
          'nav.home': 'Ilé',
          'nav.browse': 'Ṣàwárí {name}',
          'player.play': 'Ṣeré',
          'nope.key': 'x',
        } as never)
      : {};

  function withDrafts() {
    const base = make();
    const audit: AuditEvent[] = [];
    const store = new MemoryStore();
    const service = new TranslationService({
      store,
      english,
      baseline: () => ({}),
      drafts,
      audit: async (e) => void audit.push(e),
      settings: {
        uiLanguages: async () => ['en'],
        setUiLanguages: async () => {},
        minPercent: async () => 80,
      },
    });
    return { ...base, service, store, audit };
  }

  it('writes draft rows, never approved ones, and skips unknown keys', async () => {
    const { service, store } = withDrafts();
    const result = await service.loadDrafts(editor, 'yo');
    expect(result).toMatchObject({ added: 3, skipped: 1 });
    const rows = await store.list('yo');
    expect(rows.map((r) => r.status)).toEqual(['draft', 'draft', 'draft']);
    expect(rows.every((r) => r.note?.includes('native review'))).toBe(true);
  });

  it('does not overwrite text a person already saved', async () => {
    const { service, store } = withDrafts();
    await service.save(editor, 'yo', 'nav.home', 'Ilé mi');
    const result = await service.loadDrafts(editor, 'yo');
    expect(result.added).toBe(2);
    expect((await store.list('yo')).find((r) => r.key === 'nav.home')!.text).toBe('Ilé mi');
  });

  it('needs an editor, records an audit event, and is a no-op for a locale without drafts', async () => {
    const { service, audit } = withDrafts();
    await expect(
      service.loadDrafts({ accountId: 'x', role: 'analyst' as never }, 'yo'),
    ).rejects.toThrow();
    await service.loadDrafts(editor, 'yo');
    expect(audit.at(-1)).toMatchObject({
      action: 'i18n.translation.import',
      targetId: 'yo:drafts:3',
    });
    expect(await service.loadDrafts(editor, 'ig')).toMatchObject({ added: 0, skipped: 0 });
  });
});
