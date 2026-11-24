import { notFound } from 'next/navigation';
import { AppShell } from '../../../../components/Shell';
import { BrowseView, parseLength, parseSort } from '../../../../components/browse/BrowseView';
import { getCatalog } from '../../../../lib/data';
import { getViewerOrGuest } from '../../../../lib/session';

export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ categorySlug: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const [{ categorySlug }, sp] = await Promise.all([params, searchParams]);
  const { ctx } = await getViewerOrGuest(`/browse/${categorySlug}`);
  const categories = await getCatalog().categories(ctx);
  if (!categories.some((c) => c.slug === categorySlug)) notFound();
  return (
    <AppShell>
      <BrowseView
        ctx={ctx}
        categorySlug={categorySlug}
        length={parseLength(sp.length)}
        sort={parseSort(sp.sort)}
      />
    </AppShell>
  );
}
