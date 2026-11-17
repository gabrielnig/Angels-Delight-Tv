import { AppShell } from '../../../components/Shell';
import { MyListScreen } from '../../../components/mylist/MyListScreen';
import { getLibrary } from '../../../lib/data';
import { requireProfile } from '../../../lib/session';

export const metadata = { title: 'My List' };

export default async function MyListPage() {
  const { ctx } = await requireProfile('/my-list');
  const page = await getLibrary().myList(ctx);
  return (
    <AppShell>
      <div className="web-page">
        <h1 className="web-page__title">My List</h1>
        <MyListScreen
          initialItems={page.items}
          total={page.total}
          nextCursor={page.nextCursor}
          hiddenCount={page.hiddenCount}
        />
      </div>
    </AppShell>
  );
}
