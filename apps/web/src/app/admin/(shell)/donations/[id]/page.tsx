import type { Metadata } from 'next';
import { forbidden, notFound } from 'next/navigation';
import { AppError } from '@ad/shared';
import { formatMoney } from '@ad/payments/money';
import { Badge } from '@/components/admin/Badge';
import { DONATION_STATUS_LABELS } from '@/components/admin/DonationsView';
import { DonationReviewPanel } from '@/components/admin/DonationReviewPanel';
import { PageHeader } from '@/components/admin/PageHeader';
import { can } from '@/lib/admin/can';
import { requireActor } from '@/lib/data/admin/session-next';
import { donationAdmin } from '@/server/donations/admin';
import { resolveReviewAction, revealDonorEmailAction } from '../actions';

export const metadata: Metadata = { title: 'Donation' };
export const dynamic = 'force-dynamic';

export default async function DonationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await requireActor(`/admin/donations/${id}`);
  if (!can(actor.role, 'donation.view')) forbidden();
  let d;
  try {
    d = await donationAdmin(actor).get(actor, id);
  } catch (error) {
    if (error instanceof AppError) notFound();
    throw error;
  }
  const status = DONATION_STATUS_LABELS[d.status];
  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Admin', href: '/admin' }, { label: 'Donations', href: '/admin/donations' }, { label: d.reference }]}
        title={formatMoney(d.paidMinor ?? d.expectedMinor, d.currency)}
        lead={d.anonymous ? 'Anonymous donor' : (d.donorName ?? 'No name given')}
      />
      <div className="adm-stack">
        <section className="adm-card adm-stack" aria-label="Gift details">
          <p>
            <Badge tone={status.tone}>{status.label}</Badge>
            {d.test ? <Badge tone="info">Test</Badge> : null}
          </p>
          <p className="adm-mono">{d.reference}</p>
          <p className="adm-muted">Email {d.emailMasked}. Receipt {d.receiptQueued ? 'queued' : 'not queued'}.</p>
          {d.status === 'needs_review' ? (
            <p>
              Expected {formatMoney(d.expectedMinor, d.currency)}, paid {d.paidMinor === null ? 'not known' : formatMoney(d.paidMinor, d.currency)}.
            </p>
          ) : null}
          {d.reviewReason ? <p className="adm-muted">Note: {d.reviewReason}</p> : null}
        </section>
        <DonationReviewPanel
          id={d.id}
          inReview={d.status === 'needs_review'}
          canResolve={can(actor.role, 'donation.resolve')}
          resolve={resolveReviewAction}
          reveal={revealDonorEmailAction}
        />
      </div>
    </>
  );
}
