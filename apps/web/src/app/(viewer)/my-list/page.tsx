import { AppShell } from '../../../components/Shell';
import { MyListExplainer } from '../../../components/guest/MyListExplainer';
import { MyListScreen } from '../../../components/mylist/MyListScreen';
import { getLibrary, getSite } from '../../../lib/data';
import { getViewerOrGuest } from '../../../lib/session';

export const metadata = { title: 'My List' };

export default async function MyListPage() {
  const viewer = await getViewerOrGuest('/my-list');
  if (viewer.kind === 'guest') {
    // My List lives on the account. A visitor gets the reason and the way in, and nothing is read (M40-S06).
    const { signUpOpen } = await getSite().content();
    return (
      <AppShell>
        <div className="web-page">
          <h1 className="web-page__title">My List</h1>
          <MyListExplainer signUpOpen={signUpOpen} kids={viewer.ctx.audience === 'kids'} />
        </div>
      </AppShell>
    );
  }
  const page = await getLibrary().myList(viewer.ctx);
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
