import { AppShell } from '../../../components/Shell';
import { MyListExplainer } from '../../../components/guest/MyListExplainer';
import { MyListControls, parseMyListState } from '../../../components/mylist/MyListControls';
import { MyListScreen } from '../../../components/mylist/MyListScreen';
import { getLibrary, getSite } from '../../../lib/data';
import { getViewerOrGuest } from '../../../lib/session';

export const metadata = { title: 'My List', robots: { index: false, follow: true } };

export default async function MyListPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
} = {}) {
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
  const state = parseMyListState((await searchParams) ?? {});
  const page = await getLibrary().myList(viewer.ctx, undefined, state);
  const counts = page.counts;
  return (
    <AppShell>
      <div className="web-page">
        <h1 className="web-page__title">My List</h1>
        {counts && counts.all > 0 ? <MyListControls state={state} counts={counts} /> : null}
        <MyListScreen
          key={`${state.filter}:${state.sort}`}
          filter={state.filter}
          sort={state.sort}
          initialItems={page.items}
          total={page.total}
          nextCursor={page.nextCursor}
          hiddenCount={page.hiddenCount}
        />
      </div>
    </AppShell>
  );
}
