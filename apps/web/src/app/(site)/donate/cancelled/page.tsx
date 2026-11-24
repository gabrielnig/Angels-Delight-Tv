import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { msg } from '@ad/shared/messages';
import { ButtonLink } from '@ad/ui';
import { AppShell } from '../../../../components/Shell';
import { DonateKids } from '../../../../components/donate/DonateKids';
import '../../../../components/donate/donate.css';
import { currentDonateGate } from '../../../../server/donations/page-data';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Gift cancelled', robots: { index: false, follow: false } };

export default async function CancelledPage() {
  const gate = await currentDonateGate();
  if (gate === 'off') notFound();
  return (
    <AppShell skin="soft">
      {gate === 'kids' ? (
        <DonateKids />
      ) : (
        <div className="donate-page">
          <div className="donate-state">
            <h1 className="donate-state__title">{msg('donate.cancelled.title')}</h1>
            <p>{msg('donate.cancelled.body')}</p>
            <div className="donate-state__actions">
              <ButtonLink href="/donate">{msg('donate.cancelled.again')}</ButtonLink>
              <ButtonLink href="/" variant="secondary">
                {msg('donate.ok.home')}
              </ButtonLink>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
