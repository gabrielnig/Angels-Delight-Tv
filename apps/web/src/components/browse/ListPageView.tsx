'use client';

import { EmptyState, ErrorState } from '@ad/ui';
import { loadMoreListAction } from '../../app/actions';
import type { CatalogItem, ListKind, Page } from '../../lib/data';
import { CardGrid } from './CardGrid';

const EMPTY_TEXT: Record<ListKind, string> = {
  new: 'New videos are added often. Check back soon.',
  trending: 'Nothing is trending yet. See what is new.',
  series: 'Series will show up here as they are added.',
  row: 'This section has no videos right now.',
};

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
  return (
    <div className="web-page">
      <h1 className="web-page__title">{title}</h1>
      {items.length === 0 ? (
        <EmptyState
          icon="list"
          title="Nothing here yet"
          description={EMPTY_TEXT[list]}
          action={{ label: 'See what is new', href: '/browse/new' }}
        />
      ) : (
        <CardGrid
          initialItems={items}
          total={total}
          nextCursor={nextCursor}
          inList={inList}
          countLabel={list === 'series' ? 'series' : 'videos'}
          showType={list === 'series'}
          loadMore={(cursor): Promise<Page<CatalogItem>> => loadMoreListAction({ list, slug, cursor })}
        />
      )}
    </div>
  );
}

/** Shown by the browse error boundary when a list cannot load. Retry is the only action. */
export function ListPageError({ reset }: { reset: () => void }) {
  return (
    <div className="web-page">
      <ErrorState
        variant="page"
        title="Could not load this list"
        description="Check your connection and try once more."
        onRetry={reset}
        retryLabel="Retry"
        focusOnMount
      />
    </div>
  );
}
