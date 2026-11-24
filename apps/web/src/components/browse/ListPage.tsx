import { notFound } from 'next/navigation';
import { getCatalog, getLibrary } from '../../lib/data';
import type { ListKind, ViewerContext } from '../../lib/data';
import { ListPageView } from './ListPageView';

/** Loads one View all list. An unknown or hidden list is a 404, a failure reaches the route's error boundary. */
export async function ListPage({
  ctx,
  list,
  slug,
}: {
  ctx: ViewerContext;
  list: ListKind;
  slug?: string;
}) {
  const [page, inList] = await Promise.all([
    getCatalog().browseList(ctx, { list, slug }),
    getLibrary().myListIds(ctx),
  ]);
  if (!page) notFound();
  return (
    <ListPageView
      list={list}
      slug={slug}
      title={page.title}
      items={page.items}
      total={page.total}
      nextCursor={page.nextCursor}
      inList={inList}
    />
  );
}
