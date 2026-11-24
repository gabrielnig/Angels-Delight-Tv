import { describe, expect, it } from 'vitest';
import { Forbidden, NotFound, ValidationFailed } from '@ad/shared';
import { SponsorReportService, type ReportStore } from './report-service';

const admin = { accountId: 'a1', role: 'admin' as const };
const editor = { accountId: 'e1', role: 'editor' as const };
const viewer = { accountId: 'v1', role: 'viewer' as const };

const make = () => {
  const audits: Record<string, unknown>[] = [];
  const store: ReportStore = {
    sponsor: async (id) => (id === 's1' ? { id: 's1', name: 'Acme' } : null),
    creatives: async () => [{ id: 'c1', headline: 'Learn' }],
    stats: async () => [{ day: '2027-01-01', creativeId: 'c1', slot: 'home_banner', impressions: 10, clicks: 1, reach: 8 }],
    audit: async (entry) => void audits.push(entry as unknown as Record<string, unknown>),
  };
  return { svc: new SponsorReportService({ store }), audits };
};

describe('SponsorReportService', () => {
  it('lets an editor read the on screen report', async () => {
    const { svc } = make();
    const r = await svc.view(editor, 's1', '2027-01-01', '2027-01-02');
    expect(r.sponsorName).toBe('Acme');
    expect(r.report.totals.impressions).toBe(10);
  });
  it('refuses a viewer', async () => {
    await expect(make().svc.view(viewer, 's1', '2027-01-01', '2027-01-02')).rejects.toBeInstanceOf(Forbidden);
  });
  it('editor cannot export', async () => {
    await expect(make().svc.exportCsv(editor, 's1', '2027-01-01', '2027-01-02')).rejects.toBeInstanceOf(Forbidden);
  });
  it('admin export is audited and returns a csv with a safe file name', async () => {
    const { svc, audits } = make();
    const out = await svc.exportCsv(admin, 's1', '2027-01-01', '2027-01-02');
    expect(out.csv.split('\r\n')[0]).toContain('sponsor');
    expect(out.fileName).toBe('sponsor-report-acme-2027-01-01-to-2027-01-02.csv');
    expect(audits).toHaveLength(1);
    expect(audits[0]).toMatchObject({ action: 'sponsor.report.export', actorAccountId: 'a1', targetId: 's1' });
  });
  it('does not audit a refused export', async () => {
    const { svc, audits } = make();
    await svc.exportCsv(editor, 's1', '2027-01-01', '2027-01-02').catch(() => undefined);
    expect(audits).toHaveLength(0);
  });
  it('rejects a range over 400 days', async () => {
    await expect(make().svc.view(admin, 's1', '2025-01-01', '2027-01-01')).rejects.toBeInstanceOf(ValidationFailed);
  });
  it('refuses an export that would be too large to send inline', async () => {
    const many = Array.from({ length: 10_001 }, (_, i) => ({
      day: '2027-01-01',
      creativeId: `c${i}`,
      slot: 'home_banner' as const,
      impressions: 1,
      clicks: 0,
      reach: 0,
    }));
    const svc = new SponsorReportService({
      store: {
        sponsor: async () => ({ id: 's1', name: 'Acme' }),
        creatives: async () => [],
        stats: async () => many,
        audit: async () => undefined,
      },
    });
    await expect(svc.exportCsv(admin, 's1', '2027-01-01', '2027-01-02')).rejects.toBeInstanceOf(ValidationFailed);
  });
  it('says not found for an unknown sponsor', async () => {
    await expect(make().svc.view(admin, 'nope', '2027-01-01', '2027-01-02')).rejects.toBeInstanceOf(NotFound);
  });
  it('builds a file name from odd sponsor names without path characters', async () => {
    const { svc } = make();
    const odd = new SponsorReportService({
      store: { ...(svc as unknown as { deps: { store: ReportStore } }).deps.store, sponsor: async () => ({ id: 's1', name: '../Etc / Pass?wd "x"' }) },
    });
    const out = await odd.exportCsv(admin, 's1', '2027-01-01', '2027-01-02');
    expect(out.fileName).toMatch(/^sponsor-report-[a-z0-9-]+-2027-01-01-to-2027-01-02\.csv$/);
  });
});
