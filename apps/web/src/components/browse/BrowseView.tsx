import { Suspense } from 'react';
import { getLocale, getTranslator } from '../../lib/i18n/server';
import { getCatalog, getLibrary } from '../../lib/data';
import type { BrowseLength, BrowseSort, ViewerContext } from '../../lib/data';
import { BrowseControls } from './BrowseControls';
import { BrowseCount, BrowseResults } from './BrowseResults';
import { BrowseCountSkeleton, BrowseSkeleton } from './BrowseSkeleton';
import { browseHref as href, parseLength, parseSort } from './browse-filters';
import { lengthOptions, sortOptions } from './browse-options';

export { parseLength, parseSort };

/**
 * Browse by category with URL-driven length and sort (S186, D-357). The title, rail and bar render at once. The
 * count and the results stream behind a skeleton that is keyed to the choices, so a change shows the skeleton
 * under the same rail and bar instead of a blank page.
 */
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
  const categories = await catalog.categories(ctx);
  // Started here, read below by the count and the results, so one request serves both.
  const page = catalog.browse(ctx, { categorySlug, length, sort });
  const inList = getLibrary().myListIds(ctx);
  const base = categorySlug ? `/browse/${categorySlug}` : '/browse';
  const key = `${categorySlug ?? 'all'}-${length}-${sort}`;

  return (
    <div className="web-page web-browse">
      <div className="web-browse__head">
        <h1 className="web-page__title">{msg('browse.title')}</h1>
        <p className="web-browse__count" aria-live="polite">
          <Suspense key={key} fallback={<BrowseCountSkeleton />}>
            <BrowseCount msg={msg} page={page} />
          </Suspense>
        </p>
      </div>
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
      <Suspense key={key} fallback={<BrowseSkeleton label={msg('browse.skeleton.label')} />}>
        <BrowseResults
          msg={msg}
          page={page}
          inList={inList}
          base={base}
          categorySlug={categorySlug}
          length={length}
          sort={sort}
        />
      </Suspense>
    </div>
  );
}
