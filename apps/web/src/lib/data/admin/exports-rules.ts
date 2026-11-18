import type { AdminAction } from '@/lib/admin/can';
import { parseAuditQuery } from './audit-adapter';
import { parseRange } from './analytics-rules';

/** Above this many rows an export is built by the worker and sent by email (M19-S05, M20-S03). */
export const INLINE_EXPORT_MAX = 10_000;

export type ExportKind = 'audit' | 'analytics';

/** The permission each kind needs, checked again on every request, download and listing. */
export const EXPORT_PERMISSION: Record<ExportKind, AdminAction> = {
  audit: 'audit.export',
  analytics: 'analytics.view',
};

export interface ExportRequest {
  kind: ExportKind;
  params: Record<string, string>;
}

const KINDS: readonly string[] = ['audit', 'analytics'];

type Source = Record<string, string | string[] | undefined>;

/**
 * Validates what came from a form or a link into the filters stored with the export. Only known keys survive,
 * so nothing else can reach the worker. The audit scope is not among them: it comes from the requester's role.
 */
export function parseExportRequest(
  kind: unknown,
  source: Source,
  now: Date = new Date(),
): ExportRequest | null {
  if (typeof kind !== 'string' || !KINDS.includes(kind)) return null;
  if (kind === 'audit') {
    const q = parseAuditQuery(source);
    const params: Record<string, string> = {};
    for (const key of ['action', 'actor', 'target', 'outcome', 'from', 'to'] as const) {
      const value = q[key];
      if (value) params[key] = value;
    }
    return { kind, params };
  }
  const { range } = parseRange({ range: 'custom', from: source.from, to: source.to }, now);
  return { kind: 'analytics', params: { from: range.from, to: range.to } };
}

export function toQueryString(request: ExportRequest): string {
  return new URLSearchParams({ kind: request.kind, ...request.params }).toString();
}

export const exportName = (kind: ExportKind): string =>
  kind === 'audit' ? 'Audit log' : 'Analytics';

export function exportFileName(
  kind: ExportKind,
  params: Record<string, string>,
  asked: Date,
): string {
  if (kind === 'audit') return `audit-log-${asked.toISOString().slice(0, 10)}.csv`;
  return `analytics-${params.from}-to-${params.to}.csv`;
}
