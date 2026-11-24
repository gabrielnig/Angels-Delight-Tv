import Link from 'next/link';
import type { AccountRole } from '@ad/shared';
import type { CaptionRow } from '@/lib/data/admin/services';
import type { CaptionState } from '@/lib/data/admin/types';
import { CaptionTable, type ApproveManyAction } from './CaptionTable';
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
  role,
  approve,
  neverEdited,
}: {
  rows: CaptionRow[];
  counts: Record<string, number>;
  active?: CaptionState;
  now: number;
  role: AccountRole;
  approve: ApproveManyAction;
  neverEdited?: boolean;
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
      {neverEdited ? (
        <p className="adm-muted">
          Showing automatic captions nobody has opened. <Link href="/admin/captions">Show all</Link>
        </p>
      ) : null}
      {rows.length === 0 ? (
        <div className="adm-card adm-table-card">
          <EmptyState
            title="No captions waiting."
            help="Every video has approved captions. New uploads will appear here."
            icon="captions"
            live={Boolean(active)}
          />
        </div>
      ) : (
        <CaptionTable rows={rows} role={role} approve={approve} now={now} />
      )}
    </div>
  );
}
