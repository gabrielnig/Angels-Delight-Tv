import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { AppShell } from '../../../../components/Shell';
import { DonateKids } from '../../../../components/donate/DonateKids';
import { DonateStatus } from '../../../../components/donate/DonateStatus';
import '../../../../components/donate/donate.css';
import { getSite } from '../../../../lib/data';
import { currentDonateGate, readDonatePage } from '../../../../server/donations/page-data';

export const dynamic = 'force-dynamic';

/** Never indexed, and the address (it carries a signed token) is not passed on as a referrer. */
export const metadata: Metadata = { title: 'Thank you', robots: { index: false, follow: false }, referrer: 'no-referrer' };

const clean = (value: string | string[] | undefined) => (typeof value === 'string' ? value.slice(0, 80) : '');

export default async function ThankYouPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const gate = await currentDonateGate();
  if (gate === 'off') notFound();
  if (gate === 'kids') {
    return (
      <AppShell skin="soft">
        <DonateKids />
      </AppShell>
    );
  }
  const params = await searchParams;
  const [data, site] = await Promise.all([readDonatePage(), getSite().content()]);
  // Only the reference and the token are read from the address. Any "status" there is ignored: the component asks the server.
  return (
    <AppShell skin="soft">
      <div className="donate-page">
        <DonateStatus
          reference={clean(params.reference)}
          token={clean(params.t)}
          title={data.thankYouTitle}
          body={data.thankYouBody}
          supportEmail={site.supportEmail}
        />
      </div>
    </AppShell>
  );
}
