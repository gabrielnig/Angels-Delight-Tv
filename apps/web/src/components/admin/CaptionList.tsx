import Link from 'next/link';
import { formatRelative } from '@/lib/admin/format';
import type { CaptionRow } from '@/lib/data/admin/services';
import type { CaptionState } from '@/lib/data/admin/types';
import { CaptionBadge } from './Badge';
import { LinkButton } from './Button';
import { EmptyState } from './states';

const FILTERS: Array<{ state?: CaptionState; label: string }> = [
  { label: 'All' },
  { state: 'needs_review', label: 'Needs review' },
  { state: 'generating', label: 'Generating' },
  { state: 'failed', label: 'Failed' },
  { state: 'approved', label: 'Approved' },
];

export function CaptionList({
  rows,
  counts,
  active,
  now,
}: {
  rows: CaptionRow[];
  counts: Record<string, number>;
  active?: CaptionState;
  now: number;
}) {
  return (
    <div className="adm-stack">
      <nav aria-label="Filter by caption state" className="adm-row">
        {FILTERS.map((filter) => {
          const selected = filter.state === active;
          return (
            <Link
              key={filter.label}
              className={`adm-tab${selected ? '' : ''}`}
              aria-current={selected ? 'true' : undefined}
              aria-selected={undefined}
              href={filter.state ? `/admin/captions?state=${filter.state}` : '/admin/captions'}
              style={
                selected
                  ? {
                      background: 'var(--color-primary)',
                      color: 'var(--color-on-primary)',
                      borderColor: 'var(--color-primary)',
                    }
                  : undefined
              }
            >
              {filter.label}{' '}
              <span className="adm-tab__count">{counts[filter.state ?? 'all'] ?? 0}</span>
            </Link>
          );
        })}
        <span className="adm-muted">Oldest first</span>
      </nav>
      <div className="adm-card adm-table-card">
        {rows.length === 0 ? (
          <EmptyState
            title="No captions waiting."
            help="Every video has approved captions. New uploads will appear here."
            icon="captions"
            live={Boolean(active)}
          />
        ) : (
          <table className="adm-table" style={{ display: 'table' }}>
            <caption className="adm-sr">Videos and their captions</caption>
            <thead>
              <tr>
                <th scope="col">Video</th>
                <th scope="col">State</th>
                <th scope="col">Language</th>
                <th scope="col" className="adm-num">
                  Cues
                </th>
                <th scope="col">Last edited</th>
                <th scope="col">
                  <span className="adm-sr">Action</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.videoId}>
                  <td>
                    <Link className="adm-vtitle" href={`/admin/captions/${row.videoId}`}>
                      {row.title}
                    </Link>
                  </td>
                  <td>
                    <CaptionBadge state={row.state} />
                  </td>
                  <td>{row.language}</td>
                  <td className="adm-num">
                    {row.cueCount ?? (row.state === 'generating' ? 'Working' : 'None')}
                  </td>
                  <td>
                    {row.lastEditedAt
                      ? `${row.lastEditedBy}, ${formatRelative(row.lastEditedAt, now)}`
                      : row.lastEditedBy}
                  </td>
                  <td>
                    <LinkButton
                      href={`/admin/captions/${row.videoId}`}
                      variant={row.state === 'needs_review' ? 'primary' : 'secondary'}
                      aria-label={`${row.state === 'needs_review' ? 'Review' : row.state === 'approved' ? 'Open' : row.state === 'failed' ? 'Retry' : row.state === 'none' ? 'Generate' : 'View'} captions for ${row.title}`}
                    >
                      {row.state === 'needs_review'
                        ? 'Review'
                        : row.state === 'approved'
                          ? 'Open'
                          : row.state === 'failed'
                            ? 'Retry'
                            : row.state === 'none'
                              ? 'Generate'
                              : 'View'}
                    </LinkButton>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
