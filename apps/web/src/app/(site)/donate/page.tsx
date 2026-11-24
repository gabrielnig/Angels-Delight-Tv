import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { msg } from '@ad/shared/messages';
import { AppShell } from '../../../components/Shell';
import { DonateForm } from '../../../components/donate/DonateForm';
import { DonateKids } from '../../../components/donate/DonateKids';
import '../../../components/donate/donate.css';
import { currentDonateGate, readDonatePage } from '../../../server/donations/page-data';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const gate = await currentDonateGate();
  if (gate !== 'ok') return { title: gate === 'kids' ? msg('donate.kids.title') : 'Not found', robots: { index: false } };
  return { title: (await readDonatePage()).introTitle };
}

export default async function DonatePage() {
  const gate = await currentDonateGate();
  if (gate === 'off') notFound();
  if (gate === 'kids') {
    return (
      <AppShell skin="soft">
        <DonateKids />
      </AppShell>
    );
  }
  const data = await readDonatePage();
  return (
    <AppShell skin="soft">
      <div className="donate-page">
        <h1 className="donate-page__title">{data.introTitle}</h1>
        <p className="donate-page__lead">{data.introBody}</p>
        {data.transparencyEnabled ? (
          <a className="donate-link" href="/transparency">
            {msg('donate.howUsed')}
          </a>
        ) : null}
        <DonateForm
          currencies={data.currencies}
          presets={data.presets}
          limits={data.limits}
          monthlyEnabled={data.monthlyEnabled}
          orgName={data.orgName}
          testMode={data.testMode}
        />
      </div>
    </AppShell>
  );
}
