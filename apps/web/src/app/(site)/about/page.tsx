import { notFound } from 'next/navigation';
import { AppShell } from '../../../components/Shell';
import { SiteTabs } from '../../../components/site/SiteTabs';
import { LegalView } from '../../../components/site/LegalView';
import { getSite } from '../../../lib/data';

export async function generateMetadata() {
  const page = await getSite().legal('about');
  return { title: page?.title ?? 'Not found' };
}

export default async function Page() {
  const page = await getSite().legal('about');
  if (!page) notFound();
  return (
    <AppShell skin="soft">
      <div className="acct-site">
        <SiteTabs current="about" />
        <LegalView page={page} />
      </div>
    </AppShell>
  );
}
