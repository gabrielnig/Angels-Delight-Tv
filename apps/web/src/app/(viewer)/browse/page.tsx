import { AppShell } from '../../../components/Shell';
import { BrowseView, parseLength, parseSort } from '../../../components/browse/BrowseView';
import { getViewerOrGuest } from '../../../lib/session';
import { pageMetadata } from '../../../server/seo/site-meta';

export async function generateMetadata() {
  return pageMetadata({ kind: 'website', path: '/browse', title: 'Browse' });
}

export default async function BrowsePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const { ctx } = await getViewerOrGuest('/browse');
  return (
    <AppShell>
      <BrowseView ctx={ctx} length={parseLength(sp.length)} sort={parseSort(sp.sort)} />
    </AppShell>
  );
}
