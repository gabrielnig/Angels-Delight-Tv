import { AppShell } from '../../../../components/Shell';
import { ListPage } from '../../../../components/browse/ListPage';
import { getViewerOrGuest } from '../../../../lib/session';

export const dynamic = 'force-dynamic';

export default async function TrendingListPage() {
  const { ctx } = await getViewerOrGuest('/browse/trending');
  return (
    <AppShell>
      <ListPage ctx={ctx} list="trending" />
    </AppShell>
  );
}
