'use client';

import { useT } from '../../lib/i18n/provider';
import { EmptyState, ErrorState } from '@ad/ui';
import { loadMoreListAction } from '../../app/actions';
import type { CatalogItem, ListKind, Page } from '../../lib/data';
import { CardGrid } from './CardGrid';

/** The page behind a row's View all link: New, Trending, Series or a curated section (M41-S08). */
export function ListPageView({
  list,
  slug,
  title,
  items,
  total,
  nextCursor,
  inList,
}: {
  list: ListKind;
  slug?: string;
  title: string;
  items: CatalogItem[];
  total: number;
  nextCursor: string | null;
  inList: string[];
}) {
  const msg = useT();
  const emptyText: Record<ListKind, string> = {
    new: msg('browse.emptyNew'),
    trending: msg('browse.emptyTrending'),
    series: msg('browse.emptySeries'),
    row: msg('browse.emptyRow'),
  };
  return (
    <div className="web-page">
      <h1 className="web-page__title">{title}</h1>
      {items.length === 0 ? (
        <EmptyState
          icon="list"
          title={msg('browse.nothingHereYet')}
          description={emptyText[list]}
          action={{ label: msg('browse.seeWhatIsNew'), href: '/browse/new' }}
        />
      ) : (
        <CardGrid
          initialItems={items}
          total={total}
          nextCursor={nextCursor}
          inList={inList}
          countLabel={list === 'series' ? 'series' : 'videos'}
          showType={list === 'series'}
          loadMore={(cursor): Promise<Page<CatalogItem>> =>
            loadMoreListAction({ list, slug, cursor })
          }
        />
      )}
    </div>
  );
}

/** Shown by the browse error boundary when a list cannot load. Retry is the only action. */
export function ListPageError({ reset }: { reset: () => void }) {
  const msg = useT();
  return (
    <div className="web-page">
      <ErrorState
        variant="page"
        title={msg('browse.couldNotLoadThis')}
        description="Check your connection and try once more."
        onRetry={reset}
        retryLabel="Retry"
        focusOnMount
      />
    </div>
  );
}
