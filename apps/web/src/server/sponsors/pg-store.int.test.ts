import { schema } from '@ad/db';
import { createTestDatabase, integrationEnabled, makeAccount, type TestDatabase } from '@ad/db/testing';
import { SponsorAdminService, type AdminActor } from '@ad/sponsors';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createPgSponsorStore } from './pg-store';

describe.skipIf(!integrationEnabled())('sponsor admin on Postgres', () => {
  let t: TestDatabase;
  let editor: AdminActor;
  let admin: AdminActor;
  beforeAll(async () => {
    t = await createTestDatabase();
    const e = makeAccount({ role: 'editor' });
    const a = makeAccount({ role: 'admin' });
    await t.db.insert(schema.accounts).values([e, a]);
    editor = { accountId: e.id, role: 'editor' };
    admin = { accountId: a.id, role: 'admin' };
  });
  afterAll(async () => {
    await t?.drop();
  });

  const serviceFor = (actor: AdminActor) =>
    new SponsorAdminService({
      store: createPgSponsorStore(t.db, actor),
      settings: { update: vi.fn(async () => undefined) },
      reauthenticate: async () => ({ ok: true }),
      ownHosts: ['site.example'],
      now: () => new Date('2026-12-10T10:00:00Z'),
    });

  const creative = { headline: 'Learn with us', body: 'Short', ctaLabel: '', destinationUrl: 'https://sponsor.example/a', altText: '', decorative: true, hasImage: false };

  it('creates, goes live and lists with derived status, writing audit rows', async () => {
    const form = { name: 'Acme Books', startDay: '2026-12-01', endDay: '2026-12-31', contactName: 'Ada', contactEmail: 'ada@acme.example', notes: 'n' };
    const { id } = await serviceFor(editor).create(editor, form);
    const added = await serviceFor(editor).addCreative(editor, id, creative, ['home_banner', 'title_card']);
    await serviceFor(admin).setStatus(admin, id, 'active');
    const list = await serviceFor(editor).list(editor);
    expect(list.find((s) => s.id === id)?.effectiveStatus).toBe('live');
    const detail = await serviceFor(editor).get(editor, id);
    expect(detail.contactEmailMasked).toBe('a**@acme.example');
    expect(detail.creatives[0]?.slots.sort()).toEqual(['home_banner', 'title_card']);
    await serviceFor(editor).updateCreative(editor, added.id, { ...creative, headline: 'New headline' }, ['title_card']);
    expect((await serviceFor(editor).get(editor, id)).creatives[0]?.slots).toEqual(['title_card']);
    const audits = await t.pool.query("SELECT action FROM audit_log WHERE action LIKE 'sponsor.%' ORDER BY id");
    expect(audits.rows.map((r) => r.action)).toEqual(['sponsor.create', 'sponsor.creative.add', 'sponsor.status', 'sponsor.creative.update']);
  });

  it('keeps drafts deletable and blocks hard delete once numbers exist', async () => {
    const f = { name: 'Gone', startDay: '', endDay: '', contactName: '', contactEmail: '', notes: '' };
    const { id } = await serviceFor(editor).create(editor, f);
    expect((await serviceFor(admin).remove(admin, id)).ok).toBe(true);
    const { id: used } = await serviceFor(editor).create(editor, { ...f, name: 'Used' });
    const c = await serviceFor(editor).addCreative(editor, used, creative, ['home_banner']);
    await t.pool.query("SELECT sponsor_stats_bump(current_date, $1, $2, 'home_banner', 1, 0, 0)", [used, c.id]);
    expect((await serviceFor(admin).remove(admin, used)).ok).toBe(false);
  });
});
