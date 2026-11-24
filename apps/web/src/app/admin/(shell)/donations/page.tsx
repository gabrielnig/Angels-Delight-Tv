import type { Metadata } from 'next';
import { forbidden } from 'next/navigation';
import { DonationsView } from '@/components/admin/DonationsView';
import { PageHeader } from '@/components/admin/PageHeader';
import { can } from '@/lib/admin/can';
import { requireActor } from '@/lib/data/admin/session-next';
import { donationAdmin } from '@/server/donations/admin';

export const metadata: Metadata = { title: 'Donations' };
export const dynamic = 'force-dynamic';

const KEYS = ['status', 'kind', 'from', 'to'] as const;
const one = (v: string | string[] | undefined) => (typeof v === 'string' ? v : '');

export default async function DonationsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const actor = await requireActor('/admin/donations');
  if (!can(actor.role, 'donation.view')) forbidden();
  const params = await searchParams;
  const filters: Record<string, string> = {};
  for (const k of KEYS) if (one(params[k])) filters[k] = one(params[k]);
  const { rows, totals } = await donationAdmin(actor).list(actor, filters);
  return (
    <>
      <PageHeader
        crumbs={[{ label: 'Admin', href: '/admin' }, { label: 'Donations' }]}
        title="Donations"
        lead="Gifts received through Paystack. Emails are masked and the names of anonymous donors are hidden."
      />
      <form method="get" className="adm-card adm-row" aria-label="Filter donations">
        <label>
          Status{' '}
          <select name="status" defaultValue={filters.status ?? ''} className="adm-input">
            <option value="">All</option>
            {['succeeded', 'pending', 'failed', 'abandoned', 'refunded', 'needs_review'].map((s) => (
              <option key={s} value={s}>{s.replace('_', ' ')}</option>
            ))}
          </select>
        </label>
        <label>
          Kind{' '}
          <select name="kind" defaultValue={filters.kind ?? ''} className="adm-input">
            <option value="">All</option>
            <option value="one_time">One time</option>
            <option value="monthly">Monthly</option>
          </select>
        </label>
        <label>
          From <input type="date" name="from" defaultValue={filters.from ?? ''} className="adm-input" />
        </label>
        <label>
          To <input type="date" name="to" defaultValue={filters.to ?? ''} className="adm-input" />
        </label>
        <button type="submit" className="adm-btn adm-btn--secondary">Apply</button>
      </form>
      <DonationsView rows={rows} totals={totals} filters={filters} canExport={can(actor.role, 'donation.export')} />
    </>
  );
}
