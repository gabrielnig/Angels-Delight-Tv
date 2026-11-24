import { pruneViewEvents } from '@ad/analytics';
import { pruneAudit } from '@ad/audit';
import { purgeLoginEvents } from '@ad/auth';
import type { Database } from '@ad/db';
import { readSetting } from '@ad/theme/settings';

/**
 * The two retention prunes, each reading its window from settings on every run so a change by the Super admin
 * applies at the next monthly run without a deploy. `maintenance` is the `ad_maintenance` connection, the only
 * role that may delete; `writer` is the worker role that records the purge (migration 0012).
 */
export function makePrunes(maintenance: Database, writer: Database) {
  return {
    async pruneAudit() {
      const retentionMonths = await readSetting(writer, 'audit.retention_months');
      return pruneAudit(maintenance, writer, { retentionMonths });
    },
    async pruneLoginEvents() {
      return purgeLoginEvents(maintenance, new Date());
    },
    async pruneViewEvents() {
      const retentionDays = await readSetting(writer, 'analytics.raw_retention_days');
      return pruneViewEvents(maintenance, { retentionDays });
    },
  };
}
