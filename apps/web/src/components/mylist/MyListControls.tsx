import { Pill, PillRow } from '@ad/ui';
import { msg } from '@ad/shared/messages';

export type MyListFilter = 'all' | 'started' | 'not_started';
export type MyListSort = 'newest' | 'oldest' | 'az' | 'za';
export interface MyListState {
  filter: MyListFilter;
  sort: MyListSort;
}
export interface MyListFilterCounts {
  all: number;
  started: number;
  notStarted: number;
}

const FILTERS: MyListFilter[] = ['all', 'started', 'not_started'];
const SORTS: MyListSort[] = ['newest', 'oldest', 'az', 'za'];

function filterLabel(filter: MyListFilter): string {
  if (filter === 'started') return msg('engage.mylist.started');
  if (filter === 'not_started') return msg('engage.mylist.notStarted');
  return msg('engage.mylist.all');
}

function sortLabel(sort: MyListSort): string {
  if (sort === 'oldest') return msg('engage.mylist.oldest');
  if (sort === 'az') return msg('engage.mylist.az');
  if (sort === 'za') return msg('engage.mylist.za');
  return msg('engage.mylist.newest');
}

type Raw = Record<string, string | string[] | undefined>;

/** The state lives in the URL, so a choice survives a refresh and can be shared (M44-S16). */
export function parseMyListState(params: Raw): MyListState {
  const filter = typeof params.filter === 'string' ? params.filter : '';
  const sort = typeof params.sort === 'string' ? params.sort : '';
  return {
    filter: (FILTERS as string[]).includes(filter) ? (filter as MyListFilter) : 'all',
    sort: (SORTS as string[]).includes(sort) ? (sort as MyListSort) : 'newest',
  };
}

export function myListHref(state: MyListState): string {
  const query = new URLSearchParams();
  if (state.filter !== 'all') query.set('filter', state.filter);
  if (state.sort !== 'newest') query.set('sort', state.sort);
  const text = query.toString();
  return text ? `/my-list?${text}` : '/my-list';
}

function countOf(counts: MyListFilterCounts, filter: MyListFilter): number {
  return filter === 'all' ? counts.all : filter === 'started' ? counts.started : counts.notStarted;
}

/** Screens S128 and S129. Plain links, so it works without script and the server renders the choice. */
export function MyListControls({
  state,
  counts,
}: {
  state: MyListState;
  counts: MyListFilterCounts;
}) {
  return (
    <div className="web-filters">
      <PillRow label={msg('engage.mylist.filterLabel')}>
        {FILTERS.map((filter) => (
          <Pill
            key={filter}
            href={myListHref({ ...state, filter })}
            current={state.filter === filter}
          >
            {`${filterLabel(filter)} ${countOf(counts, filter)}`}
          </Pill>
        ))}
      </PillRow>
      <PillRow label={msg('engage.mylist.sortLabel')}>
        {SORTS.map((sort) => (
          <Pill
            key={sort}
            href={myListHref({ ...state, sort })}
            current={state.sort === sort}
          >
            {sortLabel(sort)}
          </Pill>
        ))}
      </PillRow>
    </div>
  );
}
