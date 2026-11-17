import { notFound } from 'next/navigation';
import { AppShell } from '../../../components/Shell';
import { LegalView } from '../../../components/site/LegalView';
import { getSite } from '../../../lib/data';

export async function generateMetadata() {
  const page = await getSite().legal('privacy');
  return { title: page?.title ?? 'Not found' };
}

export default async function Page() {
  const page = await getSite().legal('privacy');
  if (!page) notFound();
  return (
    <AppShell>
      <LegalView page={page} />
    </AppShell>
  );
}
