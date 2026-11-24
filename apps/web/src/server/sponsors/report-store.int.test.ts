import { schema } from '@ad/db';
import { createTestDatabase, integrationEnabled, makeAccount, type TestDatabase } from '@ad/db/testing';
import { SponsorAdminService, SponsorReportService, type AdminActor } from '@ad/sponsors';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createPgSponsorStore } from './pg-store';
import { createPgReportStore } from './report-store';

describe.skipIf(!integrationEnabled())('sponsor report on Postgres', () => {
  let t: TestDatabase;
  let editor: AdminActor;
  let admin: AdminActor;
  let sponsorId = '';
  let creativeId = '';
  beforeAll(async () => {
    t = await createTestDatabase();
    const e = makeAccount({ role: 'editor' });
    const a = makeAccount({ role: 'admin' });
    await t.db.insert(schema.accounts).values([e, a]);
    editor = { accountId: e.id, role: 'editor' };
    admin = { accountId: a.id, role: 'admin' };
    const svc = new SponsorAdminService({
      store: createPgSponsorStore(t.db, admin),
      settings: { update: vi.fn(async () => undefined) },
      reauthenticate: async () => ({ ok: true }),
      ownHosts: ['site.example'],
    });
    sponsorId = (await svc.create(admin, { name: 'Acme', startDay: '', endDay: '', contactName: '', contactEmail: '', notes: '' })).id;
    creativeId = (
      await svc.addCreative(admin, sponsorId, { headline: 'Learn', body: '', ctaLabel: '', destinationUrl: 'https://sponsor.example/a', altText: '', decorative: true, hasImage: false }, ['home_banner'])
    ).id;
    await t.pool.query("SELECT sponsor_stats_bump('2027-01-02', $1, $2, 'home_banner', 10, 2, 7)", [sponsorId, creativeId]);
    await t.pool.query("SELECT sponsor_stats_bump('2027-02-20', $1, $2, 'home_banner', 99, 9, 9)", [sponsorId, creativeId]);
  });
  afterAll(async () => {
    await t?.drop();
  });

  const reportFor = (actor: AdminActor) => new SponsorReportService({ store: createPgReportStore(t.db, actor) });

  it('reads only the days in the range and zero fills the rest', async () => {
    const { report, sponsorName } = await reportFor(editor).view(editor, sponsorId, '2027-01-01', '2027-01-03');
    expect(sponsorName).toBe('Acme');
    expect(report.totals).toMatchObject({ impressions: 10, clicks: 2, peakDailyReach: 7 });
    expect(report.days.map((d) => d.impressions)).toEqual([0, 10, 0]);
    expect(report.byCreative[0]).toMatchObject({ headline: 'Learn', impressions: 10 });
  });
  it('exports for an admin and writes an audit row', async () => {
    const out = await reportFor(admin).exportCsv(admin, sponsorId, '2027-01-01', '2027-03-01');
    expect(out.csv).toContain('Acme,2027-01-02,Learn,home_banner,10,2,0.2,7');
    const audits = await t.pool.query("SELECT action FROM audit_log WHERE action = 'sponsor.report.export'");
    expect(audits.rowCount).toBe(1);
  });
});
