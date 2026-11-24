import Link from 'next/link';
import { Badge, type BadgeTone } from './Badge';
import { Button, LinkButton } from './Button';
import { Banner, EmptyState } from './states';
import type { IconName } from './Icon';

export interface ExportItem {
  id: string;
  name: string;
  status: 'queued' | 'running' | 'ready' | 'failed';
  rows: number | null;
  bytes: number | null;
  askedAt: string;
  expiresAt: string | null;
  error: string | null;
}

export type ExportNotice = 'asked' | 'busy' | 'invalid' | 'failed';

const STATUS: Record<ExportItem['status'], { label: string; tone: BadgeTone; icon: IconName }> = {
  queued: { label: 'Waiting', tone: 'neutral', icon: 'clock' },
  running: { label: 'Building', tone: 'info', icon: 'clock' },
  ready: { label: 'Ready', tone: 'success', icon: 'check' },
  failed: { label: 'Failed', tone: 'danger', icon: 'alert' },
};

const NOTICES: Record<ExportNotice, { tone: 'success' | 'danger'; text: string }> = {
  asked: {
    tone: 'success',
    text: 'We are building your file. We will email you a link when it is ready.',
  },
  busy: {
    tone: 'danger',
    text: 'You already have exports waiting. Wait for one to finish, then ask again.',
  },
  invalid: {
    tone: 'danger',
    text: 'That export could not be started. Check the filters and try again.',
  },
  failed: {
    tone: 'danger',
    text: 'We could not start that export. Nothing was changed. Try again.',
  },
};

const DAY = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'Africa/Lagos',
});
const number = new Intl.NumberFormat('en-US');

function size(bytes: number | null): string {
  if (bytes === null) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** The person's own exports (M19-S05, M20-S03). Large files are built in the background and emailed. */
export function ExportsView({ items, notice }: { items: ExportItem[]; notice?: ExportNotice }) {
  const banner = notice ? NOTICES[notice] : null;
  return (
    <>
      {banner ? <Banner tone={banner.tone}>{banner.text}</Banner> : null}
      {items.length === 0 ? (
        <EmptyState
          icon="download"
          title="No exports yet."
          help="When you export something larger than 10,000 rows, it is built here and we email you a link."
        />
      ) : (
        <div className="adm-card adm-table-card">
          <table className="adm-table adm-table--always adm-table--sticky">
            <caption className="adm-sr">Your exports, newest first</caption>
            <thead>
              <tr>
                <th scope="col">Export</th>
                <th scope="col">Asked</th>
                <th scope="col">Status</th>
                <th scope="col" className="adm-num">Rows</th>
                <th scope="col" className="adm-num">Size</th>
                <th scope="col">File</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const status = STATUS[item.status];
                return (
                  <tr key={item.id}>
                    <th scope="row">{item.name}</th>
                    <td>{DAY.format(new Date(item.askedAt))}</td>
                    <td>
                      <Badge tone={status.tone} icon={status.icon}>
                        {status.label}
                      </Badge>
                      {item.status === 'failed' && item.error ? (
                        <p className="adm-muted" style={{ margin: 'var(--space-1) 0 0' }}>
                          {item.error}
                        </p>
                      ) : null}
                    </td>
                    <td className="adm-num">{item.rows === null ? '' : number.format(item.rows)}</td>
                    <td className="adm-num">{size(item.bytes)}</td>
                    <td>
                      {item.status === 'ready' ? (
                        <>
                          <Link
                            href={`/admin/exports/${item.id}/download`}
                            className="adm-link"
                            aria-label={`Download ${item.name}`}
                            prefetch={false}
                          >
                            Download
                          </Link>
                          {item.expiresAt ? (
                            <p className="adm-muted" style={{ margin: 'var(--space-1) 0 0' }}>
                              Until {DAY.format(new Date(item.expiresAt))}
                            </p>
                          ) : null}
                        </>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

/**
 * The step before a large export. Opening this page changes nothing; the button posts a form, which is the only
 * thing that starts the job (no side effect on a GET).
 */
export function ExportConfirm({
  name,
  rows,
  summary,
  fields,
  action,
}: {
  name: string;
  rows: number;
  summary: string[];
  fields: Record<string, string>;
  action: (formData: FormData) => void | Promise<void>;
}) {
  return (
    <form action={action} method="post" className="adm-card adm-stack">
      <h2 className="adm-h3">{name} is too big to download here</h2>
      <p>
        This export has {number.format(rows)} rows. We will build the file in the background and
        email you a link when it is ready. The file stays for 3 days and only you can open it.
      </p>
      {summary.length > 0 ? (
        <ul className="adm-plain-list">
          {summary.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      ) : null}
      {Object.entries(fields).map(([key, value]) => (
        <input key={key} type="hidden" name={key} value={value} />
      ))}
      <div className="adm-row">
        <Button type="submit" variant="primary" icon="download">
          Build the file and email me
        </Button>
        <LinkButton href="/admin/exports" variant="ghost">
          Cancel
        </LinkButton>
      </div>
    </form>
  );
}
