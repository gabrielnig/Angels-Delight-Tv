import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { msg } from '@ad/shared/messages';
import { AppShell } from '../../../components/Shell';
import { DonateKids } from '../../../components/donate/DonateKids';
import { TransparencyList } from '../../../components/donate/TransparencyList';
import { currentTransparencyGate, readTransparency } from '../../../server/donations/page-data';
import { pageMetadata } from '../../../server/seo/site-meta';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const gate = await currentTransparencyGate();
  if (gate === 'off') return pageMetadata({ kind: 'private', path: '/transparency', title: 'Not found' });
  if (gate === 'kids') return pageMetadata({ kind: 'private', path: '/transparency', title: msg('donate.kids.title') });
  return pageMetadata({ kind: 'website', path: '/transparency', title: (await readTransparency()).title });
}

export default async function TransparencyPage() {
  const gate = await currentTransparencyGate();
  if (gate === 'off') notFound();
  if (gate === 'kids') {
    return (
      <AppShell skin="soft">
        <DonateKids />
      </AppShell>
    );
  }
  const data = await readTransparency();
  return (
    <AppShell skin="soft">
      <TransparencyList title={data.title} intro={data.intro} items={data.items} updatedAt={data.updatedAt} />
    </AppShell>
  );
}
