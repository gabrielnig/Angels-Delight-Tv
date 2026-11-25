import { EmptyState } from '@ad/ui';
import { getLocale, getTranslator } from '../../lib/i18n/server';
import { getCatalog, getLibrary } from '../../lib/data';
import type { BrowseLength, BrowseSort, ViewerContext } from '../../lib/data';
import { BrowseGrid } from './BoundGrids';
import { BrowseControls } from './BrowseControls';
import { browseHref as href, parseLength, parseSort } from './browse-filters';
import { lengthOptions, sortOptions } from './browse-options';

export { parseLength, parseSort };

/** Browse by category with URL-driven length and sort filters. */
export async function BrowseView({
  ctx,
  categorySlug,
  length,
  sort,
}: {
  ctx: ViewerContext;
  categorySlug?: string;
  length: BrowseLength;
  sort: BrowseSort;
}) {
  const catalog = getCatalog();
  const msg = await getTranslator(await getLocale());
  const [categories, page, inList] = await Promise.all([
    catalog.categories(ctx),
    catalog.browse(ctx, { categorySlug, length, sort }),
    getLibrary().myListIds(ctx),
  ]);
  const base = categorySlug ? `/browse/${categorySlug}` : '/browse';
  const filtered = length !== 'any';

  return (
    <div className="web-page">
      <h1 className="web-page__title">Browse</h1>
      <BrowseControls
        base={base}
        length={length}
        sort={sort}
        railLabel={msg('browse.rail.label')}
        railItems={[
          { href: href('/browse', length, sort), label: msg('browse.rail.all'), current: !categorySlug },
          ...categories.map((c) => ({
            href: href(`/browse/${c.slug}`, length, sort),
            label: c.name,
            current: categorySlug === c.slug,
          })),
        ]}
        lengthOptions={lengthOptions(msg)}
        sortOptions={sortOptions(msg)}
      />
      {page.items.length === 0 ? (
        filtered ? (
          <EmptyState
            live
            icon="search"
            title="No videos match these filters"
            description="Try a different length or clear your filters."
            action={{ label: 'Clear filters', href: href(base, 'any', sort) }}
          />
        ) : (
          <EmptyState
            icon="list"
            title="Nothing here yet"
            description="New videos are added often. Check back soon."
            action={{ label: 'Back to Home', href: '/' }}
          />
        )
      ) : (
        <BrowseGrid
          key={`${categorySlug ?? 'all'}-${length}-${sort}`}
          initialItems={page.items}
          total={page.total}
          nextCursor={page.nextCursor}
          inList={inList}
          categorySlug={categorySlug}
          length={length}
          sort={sort}
        />
      )}
    </div>
  );
}
