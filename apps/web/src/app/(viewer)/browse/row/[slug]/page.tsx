import { AppShell } from '../../../../../components/Shell';
import { ListPage } from '../../../../../components/browse/ListPage';
import { getViewerOrGuest } from '../../../../../lib/session';

export const dynamic = 'force-dynamic';

export default async function RowListPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { ctx } = await getViewerOrGuest(`/browse/row/${slug}`);
  return (
    <AppShell>
      <ListPage ctx={ctx} list="row" slug={slug} />
    </AppShell>
  );
}
