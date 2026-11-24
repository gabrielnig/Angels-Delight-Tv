import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { msg } from '@ad/shared/messages';
import { AppShell } from '../../../components/Shell';
import { DonateKids } from '../../../components/donate/DonateKids';
import { TransparencyList } from '../../../components/donate/TransparencyList';
import { currentTransparencyGate, readTransparency } from '../../../server/donations/page-data';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const gate = await currentTransparencyGate();
  if (gate === 'off') return { title: 'Not found', robots: { index: false } };
  if (gate === 'kids') return { title: msg('donate.kids.title'), robots: { index: false } };
  return { title: (await readTransparency()).title };
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
