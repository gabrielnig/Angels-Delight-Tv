import { AppShell } from '../../../components/Shell';
import { BrowseView, parseLength, parseSort } from '../../../components/browse/BrowseView';
import { requireProfile } from '../../../lib/session';

export const metadata = { title: 'Browse' };

export default async function BrowsePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const { ctx } = await requireProfile('/browse');
  return (
    <AppShell>
      <BrowseView ctx={ctx} length={parseLength(sp.length)} sort={parseSort(sp.sort)} />
    </AppShell>
  );
}
