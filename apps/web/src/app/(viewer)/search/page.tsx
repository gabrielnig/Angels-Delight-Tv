import { EmptyState, ErrorState } from '@ad/ui';
import { RateLimited } from '@ad/shared';
import { SlowDownRefresh } from '../../../components/browse/SlowDown';
import { NoResults } from '../../../components/browse/NoResults';
import { AppShell } from '../../../components/Shell';
import { SearchGrid } from '../../../components/browse/BoundGrids';
import { SearchScreen } from '../../../components/browse/SearchScreen';
import { getCatalog, getLibrary } from '../../../lib/data';
import { requireProfile } from '../../../lib/session';

export const metadata = { title: 'Search' };

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const q = ((await searchParams).q ?? '').trim().slice(0, 100);
  const { ctx } = await requireProfile('/search');
  let body;
  if (!q) {
    const popular = await getCatalog()
      .popular(ctx)
      .catch(() => []);
    body = (
      <EmptyState
        icon="search"
        title="Search for something to watch"
        description={
          popular.length
            ? `Try ${popular
                .slice(0, 3)
                .map((p) => p.title)
                .join(', ')}.`
            : 'Type a title or a topic.'
        }
      />
    );
  } else {
    try {
      const [page, inList] = await Promise.all([
        getCatalog().search(ctx, q),
        getLibrary().myListIds(ctx),
      ]);
      body =
        page.items.length === 0 ? (
          <NoResults
            query={q}
            inList={inList}
            popular={await getCatalog()
              .popular(ctx)
              .catch(() => [])}
          />
        ) : (
          <SearchGrid
            key={q}
            q={q}
            initialItems={page.items}
            total={page.total}
            nextCursor={page.nextCursor}
            inList={inList}
          />
        );
    } catch (error) {
      body =
        error instanceof RateLimited ? (
          <SlowDownRefresh seconds={error.retryAfterSeconds} />
        ) : (
          <ErrorState
            variant="inline"
            title="Search is not working right now"
            description="Try again in a moment."
          />
        );
    }
  }
  return (
    <AppShell>
      <div className="web-page">
        <h1 className="web-page__title">Search</h1>
        <SearchScreen initialValue={q} />
        {body}
      </div>
    </AppShell>
  );
}
