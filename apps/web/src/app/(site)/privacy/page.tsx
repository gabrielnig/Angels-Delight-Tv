import { notFound } from 'next/navigation';
import { AppShell } from '../../../components/Shell';
import { StorageList } from '../../../components/consent/StorageList';
import { SiteTabs } from '../../../components/site/SiteTabs';
import { LegalView } from '../../../components/site/LegalView';
import { getSite } from '../../../lib/data';
import { pageMetadata } from '../../../server/seo/site-meta';

export async function generateMetadata() {
  const page = await getSite().legal('privacy');
  if (!page) return pageMetadata({ kind: 'private', path: '/privacy', title: 'Not found' });
  return pageMetadata({ kind: 'website', path: '/privacy', title: page.title });
}

export default async function Page() {
  const page = await getSite().legal('privacy');
  if (!page) notFound();
  return (
    <AppShell skin="soft">
      <div className="acct-site">
        <SiteTabs current="privacy" />
        <LegalView page={page} />
        <StorageList />
      </div>
    </AppShell>
  );
}
