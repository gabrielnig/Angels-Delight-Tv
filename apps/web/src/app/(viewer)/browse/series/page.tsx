import { AppShell } from '../../../../components/Shell';
import { ListPage } from '../../../../components/browse/ListPage';
import { getViewerOrGuest } from '../../../../lib/session';

export const dynamic = 'force-dynamic';

export default async function SeriesListPage() {
  const { ctx } = await getViewerOrGuest('/browse/series');
  return (
    <AppShell>
      <ListPage ctx={ctx} list="series" />
    </AppShell>
  );
}
