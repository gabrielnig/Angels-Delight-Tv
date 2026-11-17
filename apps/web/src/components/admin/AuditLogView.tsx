import Link from 'next/link';
import { formatDateTime } from '@/lib/admin/format';
import { serializeAuditQuery } from '@/lib/data/admin/audit-adapter';
import type { AuditQuery } from '@/lib/data/admin/audit-adapter';
import type { AuditRow } from '@/lib/data/admin/types';
import { Badge } from './Badge';
import { Button, LinkButton } from './Button';
import { EmptyState } from './states';

const OUTCOME = {
  success: { tone: 'success', icon: 'check', label: 'Done' },
  failure: { tone: 'danger', icon: 'alert', label: 'Failed' },
  denied: { tone: 'warning', icon: 'lock', label: 'Blocked' },
} as const;

const href = (
  query: AuditQuery,
  extra: Partial<AuditQuery>,
  drop: Array<keyof AuditQuery> = [],
) => {
  const qs = serializeAuditQuery({ ...query, ...extra }, drop);
  return qs ? `/admin/audit-log?${qs}` : '/admin/audit-log';
};

/** Server rendered: filters are a GET form and the detail panel is chosen with ?entry=, so it works without scripts. */
export function AuditLogView({
  rows,
  nextCursor,
  query,
  selected,
}: {
  rows: AuditRow[];
  nextCursor: string | null;
  query: AuditQuery;
  selected: AuditRow | null;
}) {
  const filtered = Boolean(
    query.action || query.actor || query.target || query.outcome || query.from || query.to,
  );
  const exportQs = serializeAuditQuery(query, ['cursor', 'entry']);
  return (
    <div className="adm-stack">
      <form
        method="get"
        className="adm-toolbar"
        role="search"
        aria-label="Filter the audit log"
        style={{ alignItems: 'flex-end' }}
      >
        <label className="adm-field">
          <span className="adm-field__label">Who</span>
          <input
            className="adm-input"
            name="actor"
            defaultValue={query.actor ?? ''}
            autoComplete="off"
          />
        </label>
        <label className="adm-field">
          <span className="adm-field__label">Action</span>
          <input
            className="adm-input"
            name="action"
            defaultValue={query.action ?? ''}
            placeholder="video. or video.publish"
            autoComplete="off"
          />
        </label>
        <label className="adm-field">
          <span className="adm-field__label">Target id</span>
          <input
            className="adm-input"
            name="target"
            defaultValue={query.target ?? ''}
            autoComplete="off"
          />
        </label>
        <label className="adm-field">
          <span className="adm-field__label">Result</span>
          <select
            className="adm-input adm-select"
            name="outcome"
            defaultValue={query.outcome ?? ''}
          >
            <option value="">Any</option>
            <option value="success">Done</option>
            <option value="failure">Failed</option>
            <option value="denied">Blocked</option>
          </select>
        </label>
        <label className="adm-field">
          <span className="adm-field__label">From</span>
          <input className="adm-input" type="date" name="from" defaultValue={query.from ?? ''} />
        </label>
        <label className="adm-field">
          <span className="adm-field__label">To</span>
          <input className="adm-input" type="date" name="to" defaultValue={query.to ?? ''} />
        </label>
        <Button type="submit" variant="primary" icon="search">
          Filter
        </Button>
        {filtered ? <LinkButton href="/admin/audit-log">Clear</LinkButton> : null}
        <LinkButton
          href={`/admin/audit-log/export${exportQs ? `?${exportQs}` : ''}`}
          icon="download"
        >
          Export CSV
        </LinkButton>
      </form>

      <div className="adm-review">
        <div className="adm-stack">
          {rows.length === 0 ? (
            <EmptyState
              title="No entries match."
              help={
                filtered
                  ? 'Try a wider date range or clear the filters.'
                  : 'Nothing has been recorded yet.'
              }
              icon="audit"
            />
          ) : (
            <div className="adm-card adm-table-card">
              <table className="adm-table" style={{ display: 'table' }}>
                <caption className="adm-sr">Audit log, newest first</caption>
                <thead>
                  <tr>
                    <th scope="col">Time</th>
                    <th scope="col">Who</th>
                    <th scope="col">Action</th>
                    <th scope="col">What</th>
                    <th scope="col">Result</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const o = OUTCOME[r.outcome];
                    return (
                      <tr key={r.id} className={selected?.id === r.id ? 'is-selected' : undefined}>
                        <td>{formatDateTime(r.at)}</td>
                        <td>{r.actorName}</td>
                        <td>
                          <Link
                            className="adm-link"
                            href={href(query, { entry: String(r.id) })}
                            aria-label={`Open details for ${r.action} at ${formatDateTime(r.at)}`}
                            aria-current={selected?.id === r.id ? 'true' : undefined}
                          >
                            {r.action}
                          </Link>
                        </td>
                        <td>{r.summary}</td>
                        <td>
                          <Badge tone={o.tone} icon={o.icon}>
                            {o.label}
                          </Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {nextCursor ? (
            <div>
              <LinkButton href={href(query, { cursor: nextCursor }, ['entry'])}>
                Older entries
              </LinkButton>
            </div>
          ) : null}
          {query.cursor ? (
            <div>
              <LinkButton href={href(query, {}, ['cursor', 'entry'])}>Back to newest</LinkButton>
            </div>
          ) : null}
        </div>
        {selected ? <AuditDetail row={selected} closeHref={href(query, {}, ['entry'])} /> : null}
      </div>
    </div>
  );
}

function AuditDetail({ row, closeHref }: { row: AuditRow; closeHref: string }) {
  const keys = [...new Set([...Object.keys(row.before ?? {}), ...Object.keys(row.after ?? {})])];
  const show = (v: unknown) =>
    v === undefined ? 'Not set' : typeof v === 'string' ? v : JSON.stringify(v);
  const o = OUTCOME[row.outcome];
  return (
    <aside className="adm-card adm-stack" aria-labelledby="audit-detail-h">
      <div className="adm-row" style={{ justifyContent: 'space-between' }}>
        <h2 className="adm-h3" id="audit-detail-h">
          Entry {row.id}
        </h2>
        <LinkButton href={closeHref}>Close</LinkButton>
      </div>
      <p style={{ margin: 0 }}>{row.summary}</p>
      <dl className="adm-dl">
        <div>
          <dt>Time</dt>
          <dd>{formatDateTime(row.at)}</dd>
        </div>
        <div>
          <dt>Who</dt>
          <dd>{row.actorName}</dd>
        </div>
        <div>
          <dt>Action</dt>
          <dd>{row.action}</dd>
        </div>
        <div>
          <dt>Result</dt>
          <dd>
            <Badge tone={o.tone} icon={o.icon}>
              {o.label}
            </Badge>
          </dd>
        </div>
        <div>
          <dt>Target</dt>
          <dd>{row.targetType ? `${row.targetType} ${row.targetId ?? ''}` : 'None'}</dd>
        </div>
        <div>
          <dt>Network</dt>
          <dd>{row.ip ?? 'Not recorded'}</dd>
        </div>
        <div>
          <dt>Request</dt>
          <dd>{row.requestId ?? 'Not recorded'}</dd>
        </div>
      </dl>
      <h3 className="adm-h3">What changed</h3>
      {keys.length === 0 ? (
        <p className="adm-muted" style={{ margin: 0 }}>
          No before and after values were recorded for this action.
        </p>
      ) : (
        <table className="adm-table" style={{ display: 'table' }}>
          <caption className="adm-sr">Values before and after</caption>
          <thead>
            <tr>
              <th scope="col">Field</th>
              <th scope="col">Before</th>
              <th scope="col">After</th>
            </tr>
          </thead>
          <tbody>
            {keys.map((k) => (
              <tr key={k}>
                <th scope="row">{k}</th>
                <td>{show(row.before?.[k])}</td>
                <td>{show(row.after?.[k])}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </aside>
  );
}
