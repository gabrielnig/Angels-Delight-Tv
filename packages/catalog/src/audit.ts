import { writeAudit as writeAuditEvent } from '@ad/audit';
import { invalidateCatalogCache } from './cache';

/**
 * Every admin change to the catalog is audited, so writing the audit row is also the moment viewers must stop
 * seeing cached data (M04-S05). The cache is emptied right away and again by its 60 second limit, which bounds the
 * small window where a read that began before the commit can store old data.
 */
export const writeAudit: typeof writeAuditEvent = async (...args) => {
  const result = await writeAuditEvent(...args);
  invalidateCatalogCache();
  return result;
};
