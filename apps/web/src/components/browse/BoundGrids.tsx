'use client';

import { loadMoreBrowseAction, loadMoreSearchAction } from '../../app/actions';
import type { BrowseLength, BrowseSort, CatalogItem, Page } from '../../lib/data';
import { CardGrid } from './CardGrid';

type Base = {
  initialItems: CatalogItem[];
  total: number;
  nextCursor: string | null;
  inList: string[];
};

export function BrowseGrid({
  categorySlug,
  length,
  sort,
  ...base
}: Base & {
  categorySlug?: string;
  length: BrowseLength;
  sort: BrowseSort;
  hideCount?: boolean;
}) {
  return (
    <CardGrid
      {...base}
      countLabel="videos"
      loadMore={(cursor): Promise<Page<CatalogItem>> =>
        loadMoreBrowseAction({ categorySlug, length, sort, cursor })
      }
    />
  );
}

export function SearchGrid({ q, ...base }: Base & { q: string }) {
  return (
    <CardGrid
      {...base}
      countLabel="results"
      showType
      loadMore={(cursor) => loadMoreSearchAction(q, cursor)}
    />
  );
}
