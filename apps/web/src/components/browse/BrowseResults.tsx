import { EmptyState } from '@ad/ui';
import type { Translate } from '@ad/shared/messages';
import type { BrowseLength, BrowseSort, CatalogItem, Page } from '../../lib/data';
import { BrowseGrid } from './BoundGrids';
import { browseHref as href } from './browse-filters';

/** The count beside the page title. Nothing when the list is empty: the empty state speaks instead. */
export async function BrowseCount({
  msg,
  page,
}: {
  msg: Translate;
  page: Promise<Page<CatalogItem>>;
}) {
  const { total } = await page;
  return total > 0 ? <>{msg('browse.count.videos', { count: total })}</> : null;
}

/**
 * The results part of Browse: the grid, or one of two empty states with a single action each (R39). It reads
 * promises so the page can stream it behind a skeleton while the rail and bar are already on screen.
 */
export async function BrowseResults({
  msg,
  page,
  inList,
  base,
  categorySlug,
  length,
  sort,
}: {
  msg: Translate;
  page: Promise<Page<CatalogItem>>;
  inList: Promise<string[]>;
  base: string;
  categorySlug?: string;
  length: BrowseLength;
  sort: BrowseSort;
}) {
  const [first, saved] = await Promise.all([page, inList]);
  if (first.items.length === 0) {
    return length !== 'any' ? (
      <EmptyState
        live
        icon="search"
        title={msg('browse.emptyFiltered.title')}
        description={msg('browse.emptyFiltered.text')}
        action={{ label: msg('browse.emptyFiltered.action'), href: href(base, 'any', 'newest') }}
      />
    ) : (
      <EmptyState
        live
        icon="list"
        title={msg('browse.empty.title')}
        description={msg('browse.empty.text')}
        action={{ label: msg('browse.empty.action'), href: '/' }}
      />
    );
  }
  return (
    <BrowseGrid
      initialItems={first.items}
      total={first.total}
      nextCursor={first.nextCursor}
      inList={saved}
      categorySlug={categorySlug}
      length={length}
      sort={sort}
      hideCount
    />
  );
}
