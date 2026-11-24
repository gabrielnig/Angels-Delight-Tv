import Link from 'next/link';
import { localeInfo, type AccountRole } from '@ad/shared';
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
  languages = [],
  activeLanguage,
}: {
  rows: CaptionRow[];
  counts: Record<string, number>;
  active?: CaptionState;
  now: number;
  role: AccountRole;
  approve: ApproveManyAction;
  neverEdited?: boolean;
  /** Translation languages that exist on any video, for the language filter (M46). */
  languages?: string[];
  activeLanguage?: string;
}) {
  const query = (state: CaptionState | undefined, lang: string | undefined) => {
    const parts = [state ? `state=${state}` : '', lang ? `lang=${lang}` : ''].filter(Boolean);
    return parts.length ? `/admin/captions?${parts.join('&')}` : '/admin/captions';
  };
  return (
    <div className="adm-stack">
      {languages.length > 0 ? (
        <nav aria-label="Filter by language" className="adm-row">
          {[undefined, ...languages].map((code) => {
            const selected = code === activeLanguage;
            return (
              <Link
                key={code ?? 'all'}
                className="adm-tab"
                aria-current={selected ? 'true' : undefined}
                href={query(active, code)}
              >
                {code ? (localeInfo(code)?.englishName ?? code) : 'All languages'}
              </Link>
            );
          })}
        </nav>
      ) : null}
      <nav aria-label="Filter by caption state" className="adm-row">
        {FILTERS.map((filter) => {
          const selected = filter.state === active;
          return (
            <Link
              key={filter.label}
              className={`adm-tab${selected ? '' : ''}`}
              aria-current={selected ? 'true' : undefined}
              aria-selected={undefined}
              href={query(filter.state, activeLanguage)}
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
