import { notFound } from 'next/navigation';
import { AppShell } from '../../../components/Shell';
import { SiteTabs } from '../../../components/site/SiteTabs';
import { LegalView } from '../../../components/site/LegalView';
import { getSite } from '../../../lib/data';
import { pageMetadata } from '../../../server/seo/site-meta';

export async function generateMetadata() {
  const page = await getSite().legal('terms');
  if (!page) return pageMetadata({ kind: 'private', path: '/terms', title: 'Not found' });
  return pageMetadata({ kind: 'website', path: '/terms', title: page.title });
}

export default async function Page() {
  const page = await getSite().legal('terms');
  if (!page) notFound();
  return (
    <AppShell skin="soft">
      <div className="acct-site">
        <SiteTabs current="terms" />
        <LegalView page={page} />
      </div>
    </AppShell>
  );
}
