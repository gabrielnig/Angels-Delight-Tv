import { AppShell } from '../../../../components/Shell';
import { ListPage } from '../../../../components/browse/ListPage';
import { getViewerOrGuest } from '../../../../lib/session';

export const dynamic = 'force-dynamic';

export default async function NewListPage() {
  const { ctx } = await getViewerOrGuest('/browse/new');
  return (
    <AppShell>
      <ListPage ctx={ctx} list="new" />
    </AppShell>
  );
}
