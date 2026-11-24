import { notFound } from 'next/navigation';
import { AppShell } from '../../../../components/Shell';
import { BrowseView, parseLength, parseSort } from '../../../../components/browse/BrowseView';
import { getCatalog } from '../../../../lib/data';
import { getViewerOrGuest } from '../../../../lib/session';
import { JsonLd } from '../../../../components/seo/JsonLd';
import { categoryPageJsonLd } from '../../../../lib/seo/page-jsonld';
import { siteOrigin } from '../../../../server/seo/page-seo';

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
  const category = categories.find((c) => c.slug === categorySlug);
  if (!category) notFound();
  return (
    <AppShell>
      <JsonLd
        data={categoryPageJsonLd({
          origin: siteOrigin(),
          name: category.name,
          slug: category.slug,
        })}
      />
      <BrowseView
        ctx={ctx}
        categorySlug={categorySlug}
        length={parseLength(sp.length)}
        sort={parseSort(sp.sort)}
      />
    </AppShell>
  );
}
