import { EmptyState, Pill, PillRow } from '@ad/ui';
import { getCatalog, getLibrary } from '../../lib/data';
import type { BrowseLength, BrowseSort, ViewerContext } from '../../lib/data';
import { BrowseGrid } from './BoundGrids';
import {
  LENGTHS,
  SORTS,
  activeChips,
  browseHref as href,
  parseLength,
  parseSort,
} from './browse-filters';

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
  const [categories, page, inList] = await Promise.all([
    catalog.categories(ctx),
    catalog.browse(ctx, { categorySlug, length, sort }),
    getLibrary().myListIds(ctx),
  ]);
  const base = categorySlug ? `/browse/${categorySlug}` : '/browse';
  const filtered = length !== 'any';
  const chips = activeChips(base, length, sort);

  return (
    <div className="web-page">
      <h1 className="web-page__title">Browse</h1>
      <PillRow label="Categories">
        <Pill href={href('/browse', length, sort)} current={!categorySlug}>
          All
        </Pill>
        {categories.map((c) => (
          <Pill
            key={c.slug}
            href={href(`/browse/${c.slug}`, length, sort)}
            current={categorySlug === c.slug}
          >
            {c.name}
          </Pill>
        ))}
      </PillRow>
      <div className="web-filters">
        <PillRow label="Length">
          {LENGTHS.map((l) => (
            <Pill key={l.value} href={href(base, l.value, sort)} current={length === l.value}>
              {l.label}
            </Pill>
          ))}
        </PillRow>
        <PillRow label="Sort by">
          {SORTS.map((s) => (
            <Pill key={s.value} href={href(base, length, s.value)} current={sort === s.value}>
              {s.label}
            </Pill>
          ))}
        </PillRow>
      </div>
      {chips.length > 0 ? (
        <ul className="web-chips" aria-label="Active filters">
          {chips.map((chip) => (
            <li key={chip.label}>
              <a className="web-chip" href={chip.removeHref}>
                <span>{chip.label}</span>
                <span className="ad-sr-only">, remove filter</span>
                <span aria-hidden="true">x</span>
              </a>
            </li>
          ))}
        </ul>
      ) : null}
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
