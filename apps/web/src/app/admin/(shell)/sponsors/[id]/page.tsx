import type { Metadata } from 'next';
import { forbidden, notFound } from 'next/navigation';
import { NotFound } from '@ad/shared';
import { Badge } from '@/components/admin/Badge';
import { LinkButton } from '@/components/admin/Button';
import { CreativesEditor } from '@/components/admin/CreativesEditor';
import { PageHeader } from '@/components/admin/PageHeader';
import { SponsorForm } from '@/components/admin/SponsorForm';
import { SponsorStatusPanel } from '@/components/admin/SponsorStatusPanel';
import { SPONSOR_STATUS_LABELS, lagosDayInput } from '@/components/admin/sponsor-labels';
import { can } from '@/lib/admin/can';
import { requireActor } from '@/lib/data/admin/session-next';
import { sponsorAdmin } from '@/server/sponsors/admin';
import {
  addCreativeAction,
  deleteSponsorAction,
  removeCreativeAction,
  setSponsorStatusAction,
  updateCreativeAction,
  updateSponsorAction,
  uploadSponsorImageAction,
} from '../actions';

export const metadata: Metadata = { title: 'Sponsor' };

export default async function SponsorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await requireActor(`/admin/sponsors/${id}`);
  if (!can(actor.role, 'sponsor.manage')) forbidden();
  const sponsor = await sponsorAdmin(actor)
    .get(actor, id)
    .catch((error: unknown) => {
      if (error instanceof NotFound) notFound();
      throw error;
    });
  const badge = SPONSOR_STATUS_LABELS[sponsor.effectiveStatus];
  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Admin', href: '/admin' }, { label: 'Sponsors', href: '/admin/sponsors' }, { label: sponsor.name }]}
        title={sponsor.name}
        lead={undefined}
        actions={
          <>
            <Badge tone={badge.tone}>{badge.label}</Badge>
            <LinkButton href={`/admin/sponsors/${id}/report`} variant="secondary">
              Report
            </LinkButton>
          </>
        }
      />
      <div className="adm-stack">
        <SponsorStatusPanel
          status={sponsor.status}
          isAdmin={can(actor.role, 'sponsor.activate')}
          setStatus={(s) => setSponsorStatusAction(id, s)}
          remove={() => deleteSponsorAction(id)}
        />
        <SponsorForm
          initial={{
            name: sponsor.name,
            startDay: lagosDayInput(sponsor.startsAt),
            endDay: lagosDayInput(sponsor.endsAt),
            contactName: sponsor.contactName ?? '',
            contactEmail: '',
            notes: sponsor.notes ?? '',
          }}
          contactEmailHint={sponsor.contactEmailMasked ? `On file: ${sponsor.contactEmailMasked}. Leave empty to clear it.` : undefined}
          save={(values) => updateSponsorAction(id, values)}
        />
        <CreativesEditor
          sponsorId={id}
          creatives={sponsor.creatives}
          actions={{
            add: addCreativeAction,
            update: updateCreativeAction,
            remove: removeCreativeAction,
            upload: uploadSponsorImageAction,
          }}
        />
      </div>
    </>
  );
}
