import { Forbidden, NotFound, ValidationFailed, isAdminRole, isStaffRole } from '@ad/shared';
import { reportToCsv } from '../csv';
import { buildReport, checkRange, type Report, type StatRow } from '../report';
import type { AdminActor } from './service';
import type { AuditEntry } from './store';

export interface ReportStore {
  sponsor(id: string): Promise<{ id: string; name: string } | null>;
  creatives(sponsorId: string): Promise<{ id: string; headline: string }[]>;
  stats(sponsorId: string, fromDay: string, toDay: string): Promise<StatRow[]>;
  audit(entry: AuditEntry): Promise<void>;
}

export interface SponsorReportView {
  sponsorId: string;
  sponsorName: string;
  report: Report;
  rows: StatRow[];
}

export const REPORT_EXPORT_MAX_ROWS = 10_000;

const slug = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'sponsor';

/** Sponsor numbers for staff. Reading is for editors and up, the CSV is for admins and is audited. */
export class SponsorReportService {
  constructor(private readonly deps: { store: ReportStore }) {}

  async view(actor: AdminActor, sponsorId: string, fromDay: string, toDay: string): Promise<SponsorReportView> {
    if (!isStaffRole(actor.role)) throw new Forbidden('Only staff can read sponsor reports');
    const range = checkRange(fromDay, toDay);
    if (!range.ok) throw new ValidationFailed({ range: [range.error] }, range.error);
    const sponsor = await this.deps.store.sponsor(sponsorId);
    if (!sponsor) throw new NotFound('That sponsor was not found');
    const [creatives, rows] = await Promise.all([
      this.deps.store.creatives(sponsorId),
      this.deps.store.stats(sponsorId, fromDay, toDay),
    ]);
    const report = buildReport({
      fromDay,
      toDay,
      rows,
      creativeNames: new Map(creatives.map((c) => [c.id, c.headline])),
    });
    return { sponsorId, sponsorName: sponsor.name, report, rows };
  }

  async exportCsv(
    actor: AdminActor,
    sponsorId: string,
    fromDay: string,
    toDay: string,
  ): Promise<{ csv: string; fileName: string }> {
    if (!isAdminRole(actor.role)) throw new Forbidden('Only an admin can export sponsor reports');
    const view = await this.view(actor, sponsorId, fromDay, toDay);
    if (view.rows.length > REPORT_EXPORT_MAX_ROWS) {
      throw new ValidationFailed({ range: ['That range is too large to export. Choose a shorter one.'] }, 'Too large');
    }
    await this.deps.store.audit({
      action: 'sponsor.report.export',
      actorAccountId: actor.accountId,
      actorRole: actor.role,
      targetType: 'sponsor',
      targetId: sponsorId,
      metadata: { fromDay, toDay },
    });
    return {
      csv: reportToCsv(view.report, view.sponsorName, { rows: view.rows }),
      fileName: `sponsor-report-${slug(view.sponsorName)}-${fromDay}-to-${toDay}.csv`,
    };
  }
}
