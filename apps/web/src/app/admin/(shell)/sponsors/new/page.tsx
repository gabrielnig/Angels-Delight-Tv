import type { Metadata } from 'next';
import { forbidden } from 'next/navigation';
import { PageHeader } from '@/components/admin/PageHeader';
import { SponsorForm } from '@/components/admin/SponsorForm';
import { can } from '@/lib/admin/can';
import { requireActor } from '@/lib/data/admin/session-next';
import { createSponsorAction } from '../actions';

export const metadata: Metadata = { title: 'Add sponsor' };

export default async function NewSponsorPage() {
  const actor = await requireActor('/admin/sponsors/new');
  if (!can(actor.role, 'sponsor.manage')) forbidden();
  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Admin', href: '/admin' }, { label: 'Sponsors', href: '/admin/sponsors' }, { label: 'Add sponsor' }]}
        title="Add sponsor"
      />
      <SponsorForm save={createSponsorAction} />
    </>
  );
}
