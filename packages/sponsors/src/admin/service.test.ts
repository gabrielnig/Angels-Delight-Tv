import { Forbidden, NotFound, ValidationFailed } from '@ad/shared';
import { describe, expect, it, vi } from 'vitest';
import { SponsorAdminService, type AdminActor } from './service';
import { MemorySponsorStore } from './memory-store';

const editor: AdminActor = { accountId: '0198c000-0000-7000-8000-0000000000e1', role: 'editor' };
const admin: AdminActor = { accountId: '0198c000-0000-7000-8000-0000000000a1', role: 'admin' };
const viewer: AdminActor = { accountId: '0198c000-0000-7000-8000-0000000000b1', role: 'viewer' };

function setup() {
  const store = new MemorySponsorStore();
  const settings = { update: vi.fn(async () => undefined) };
  const reauthenticate = vi.fn(async (_a: AdminActor, pw: string) =>
    pw === 'right' ? ({ ok: true } as const) : ({ ok: false, error: 'Password is not right' } as const),
  );
  const service = new SponsorAdminService({
    store,
    settings,
    reauthenticate,
    ownHosts: ['site.example'],
    now: () => new Date('2026-12-10T10:00:00Z'),
  });
  return { store, service, settings, reauthenticate };
}

const creativeInput = {
  headline: 'Learn with us',
  body: 'Short',
  ctaLabel: 'Learn more',
  destinationUrl: 'https://sponsor.example/a',
  altText: '',
  decorative: true,
  weight: 1,
  hasImage: false,
};

describe('sponsor admin service', () => {
  it('an editor can create a draft sponsor', async () => {
    const { service, store } = setup();
    const created = await service.create(editor, { name: ' Acme Books ', startDay: '', endDay: '', contactName: '', contactEmail: '', notes: '' });
    const row = store.sponsors.get(created.id);
    expect(row?.name).toBe('Acme Books');
    expect(row?.status).toBe('draft');
    expect(row?.createdBy).toBe(editor.accountId);
  });

  it('a viewer cannot do anything', async () => {
    const { service } = setup();
    await expect(service.create(viewer, { name: 'x', startDay: '', endDay: '', contactName: '', contactEmail: '', notes: '' })).rejects.toBeInstanceOf(Forbidden);
    await expect(service.list(viewer)).rejects.toBeInstanceOf(Forbidden);
  });

  it('rejects an invalid name or schedule with field errors', async () => {
    const { service } = setup();
    const error = await service
      .create(editor, { name: '', startDay: '2026-12-10', endDay: '2026-12-01', contactName: '', contactEmail: '', notes: '' })
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ValidationFailed);
    expect(Object.keys((error as ValidationFailed).fields).sort()).toEqual(['endDay', 'name']);
  });

  it('stores the contact encrypted through the sealer and shows it masked', async () => {
    const { service, store } = setup();
    const { id } = await service.create(editor, { name: 'Acme', startDay: '', endDay: '', contactName: 'Ada', contactEmail: 'ada@acme.example', notes: 'call in Jan' });
    const priv = store.privates.get(id);
    expect(priv?.contactEmailSealed).not.toContain('ada@acme.example');
    expect(priv?.notes).toBe('call in Jan');
    const detail = await service.get(editor, id);
    expect(detail.contactEmailMasked).toBe('a**@acme.example');
  });

  it('only admin can set status live (active)', async () => {
    const { service } = setup();
    const { id } = await service.create(editor, { name: 'Acme', startDay: '', endDay: '', contactName: '', contactEmail: '', notes: '' });
    await expect(service.setStatus(editor, id, 'active')).rejects.toBeInstanceOf(Forbidden);
    await expect(service.setStatus(editor, id, 'archived')).rejects.toBeInstanceOf(Forbidden);
    await service.addCreative(editor, id, creativeInput, ['home_banner']);
    await service.setStatus(admin, id, 'active');
    await service.setStatus(editor, id, 'paused');
    const detail = await service.get(admin, id);
    expect(detail.status).toBe('paused');
    expect(detail.effectiveStatus).toBe('paused');
  });

  it('refuses to go live without a creative that has a placement', async () => {
    const { service } = setup();
    const { id } = await service.create(editor, { name: 'Acme', startDay: '', endDay: '', contactName: '', contactEmail: '', notes: '' });
    const err = await service.setStatus(admin, id, 'active').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ValidationFailed);
    await service.addCreative(editor, id, creativeInput, ['home_banner']);
    await service.setStatus(admin, id, 'active');
  });

  it('lists derived status, so a late worker never shows an ended sponsor', async () => {
    const { service } = setup();
    const { id } = await service.create(editor, { name: 'Acme', startDay: '2026-11-01', endDay: '2026-11-30', contactName: '', contactEmail: '', notes: '' });
    await service.addCreative(editor, id, creativeInput, ['title_card']);
    await service.setStatus(admin, id, 'active');
    const rows = await service.list(editor);
    expect(rows[0]?.effectiveStatus).toBe('ended');
  });

  it('rejects a bad destination when adding a creative', async () => {
    const { service } = setup();
    const { id } = await service.create(editor, { name: 'Acme', startDay: '', endDay: '', contactName: '', contactEmail: '', notes: '' });
    for (const url of ['http://sponsor.example', 'https://site.example/admin', 'https://localhost/x']) {
      await expect(service.addCreative(editor, id, { ...creativeInput, destinationUrl: url }, ['home_banner'])).rejects.toBeInstanceOf(ValidationFailed);
    }
  });

  it('warns but allows a creative with no placement', async () => {
    const { service } = setup();
    const { id } = await service.create(editor, { name: 'Acme', startDay: '', endDay: '', contactName: '', contactEmail: '', notes: '' });
    const r = await service.addCreative(editor, id, creativeInput, []);
    expect(r.warnings.join(' ')).toMatch(/never shown/i);
  });

  it('rejects an unknown slot', async () => {
    const { service } = setup();
    const { id } = await service.create(editor, { name: 'Acme', startDay: '', endDay: '', contactName: '', contactEmail: '', notes: '' });
    await expect(service.addCreative(editor, id, creativeInput, ['footer' as never])).rejects.toBeInstanceOf(ValidationFailed);
  });

  it('master switch change needs reauth and is admin only', async () => {
    const { service, settings, reauthenticate } = setup();
    await expect(service.setMasterSwitch(editor, true, 'right')).rejects.toBeInstanceOf(Forbidden);
    const bad = await service.setMasterSwitch(admin, true, 'wrong');
    expect(bad.ok).toBe(false);
    expect(settings.update).not.toHaveBeenCalled();
    const ok = await service.setMasterSwitch(admin, true, 'right');
    expect(ok.ok).toBe(true);
    expect(reauthenticate).toHaveBeenCalledTimes(2);
    expect(settings.update).toHaveBeenCalledWith(admin, { 'sponsors.enabled': true });
  });

  it('each action writes an audit row', async () => {
    const { service, store } = setup();
    const { id } = await service.create(editor, { name: 'Acme', startDay: '', endDay: '', contactName: '', contactEmail: '', notes: '' });
    await service.update(editor, id, { name: 'Acme 2', startDay: '', endDay: '', contactName: '', contactEmail: '', notes: '' });
    const added = await service.addCreative(editor, id, creativeInput, ['home_banner']);
    await service.setStatus(admin, id, 'active');
    await service.removeCreative(editor, added.id);
    await service.setMasterSwitch(admin, false, 'right');
    expect(store.audits.map((a) => a.action)).toEqual([
      'sponsor.create',
      'sponsor.update',
      'sponsor.creative.add',
      'sponsor.status',
      'sponsor.creative.remove',
      'sponsor.master',
    ]);
    expect(JSON.stringify(store.audits)).not.toContain('ada@');
  });

  it('hard delete is admin only and blocked when stats exist', async () => {
    const { service, store } = setup();
    const { id } = await service.create(editor, { name: 'Acme', startDay: '', endDay: '', contactName: '', contactEmail: '', notes: '' });
    await expect(service.remove(editor, id)).rejects.toBeInstanceOf(Forbidden);
    store.statsFor.add(id);
    const blocked = await service.remove(admin, id);
    expect(blocked.ok).toBe(false);
    expect(!blocked.ok && blocked.error).toMatch(/archive/i);
    store.statsFor.delete(id);
    expect((await service.remove(admin, id)).ok).toBe(true);
    await expect(service.get(admin, id)).rejects.toBeInstanceOf(NotFound);
  });

  it('replaces placements on update', async () => {
    const { service, store } = setup();
    const { id } = await service.create(editor, { name: 'Acme', startDay: '', endDay: '', contactName: '', contactEmail: '', notes: '' });
    const c = await service.addCreative(editor, id, creativeInput, ['home_banner', 'title_card']);
    await service.updateCreative(editor, c.id, creativeInput, ['title_card']);
    expect([...(store.placements.get(c.id) ?? [])]).toEqual(['title_card']);
  });
});
