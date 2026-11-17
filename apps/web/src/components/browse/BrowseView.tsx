import { EmptyState, Pill, PillRow } from '@ad/ui';
import { getCatalog, getLibrary } from '../../lib/data';
import type { BrowseLength, BrowseSort, ViewerContext } from '../../lib/data';
import { BrowseGrid } from './BoundGrids';

const LENGTHS: Array<{ value: BrowseLength; label: string }> = [
  { value: 'any', label: 'Any length' },
  { value: 'short', label: 'Under 5 min' },
  { value: 'medium', label: '5 to 15 min' },
  { value: 'long', label: 'Over 15 min' },
];
const SORTS: Array<{ value: BrowseSort; label: string }> = [
  { value: 'newest', label: 'Newest' },
  { value: 'shortest', label: 'Shortest' },
  { value: 'longest', label: 'Longest' },
];

export function parseLength(v: string | undefined): BrowseLength {
  return LENGTHS.some((l) => l.value === v) ? (v as BrowseLength) : 'any';
}
export function parseSort(v: string | undefined): BrowseSort {
  return SORTS.some((s) => s.value === v) ? (v as BrowseSort) : 'newest';
}

function href(base: string, length: BrowseLength, sort: BrowseSort) {
  const params = new URLSearchParams();
  if (length !== 'any') params.set('length', length);
  if (sort !== 'newest') params.set('sort', sort);
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}

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
