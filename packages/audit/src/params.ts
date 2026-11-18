import type { AuditFilters } from './query';

const OUTCOMES = ['success', 'failure', 'denied'] as const;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const ID = /^[0-9a-f-]{36}$/i;

function dayStart(value: string | undefined): number | null {
  if (!value || !DAY.test(value)) return null;
  const ms = Date.parse(`${value}T00:00:00Z`);
  return Number.isNaN(ms) || new Date(ms).toISOString().slice(0, 10) !== value ? null : ms;
}

/**
 * Turns the filters stored with an export into query filters. The scope is passed in, never read from the
 * stored values, so a form can never widen it. Unknown keys and malformed values are dropped.
 */
export function auditFiltersFromParams(
  params: Record<string, string | undefined>,
  scope: 'all' | 'content',
): AuditFilters {
  const from = dayStart(params.from);
  const to = dayStart(params.to);
  const outcome = OUTCOMES.find((o) => o === params.outcome);
  return {
    ...(params.action ? { action: params.action } : {}),
    ...(params.actor && ID.test(params.actor) ? { actorAccountId: params.actor } : {}),
    ...(params.target ? { targetId: params.target } : {}),
    ...(outcome ? { outcome } : {}),
    ...(from !== null ? { from: new Date(from) } : {}),
    ...(to !== null ? { to: new Date(to + 86_400_000) } : {}),
    scope,
  };
}
