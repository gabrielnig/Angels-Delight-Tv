import Link from 'next/link';
import { formatMoney, type Currency } from '@ad/payments/money';
import type { DonationListItem, Totals } from '@ad/payments';
import { Badge, type BadgeTone } from './Badge';
import { LinkButton } from './Button';
import { EmptyState } from './states';

export const DONATION_STATUS_LABELS: Record<DonationListItem['status'], { label: string; tone: BadgeTone }> = {
  succeeded: { label: 'Succeeded', tone: 'success' },
  pending: { label: 'Pending', tone: 'neutral' },
  failed: { label: 'Failed', tone: 'danger' },
  abandoned: { label: 'Abandoned', tone: 'neutral' },
  refunded: { label: 'Refunded', tone: 'warning' },
  needs_review: { label: 'Needs review', tone: 'warning' },
};

const day = (d: Date) => new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Lagos', day: 'numeric', month: 'short', year: 'numeric' }).format(d);
const money = (minor: number, currency: Currency) => formatMoney(minor, currency);

export function DonationsView({
  rows,
  totals,
  filters,
  canExport,
}: {
  rows: DonationListItem[];
  totals: Totals;
  filters: Record<string, string>;
  canExport: boolean;
}) {
  const query = new URLSearchParams(filters).toString();
  const currencies = (Object.keys(totals) as Currency[]).sort();
  return (
    <div className="adm-stack">
      <section className="adm-card adm-stack" aria-label="Totals">
        {currencies.length === 0 ? <p className="adm-muted">No succeeded live gifts in this view.</p> : (
          <ul className="adm-stack">
            {currencies.map((c) => (
              <li key={c}>
                <strong>{money(totals[c]!.minor, c)}</strong> from {totals[c]!.count} {totals[c]!.count === 1 ? 'gift' : 'gifts'}
              </li>
            ))}
          </ul>
        )}
        <p className="adm-muted">Test gifts are not counted. Currencies are never added together.</p>
      </section>
      {canExport ? (
        <div>
          <LinkButton href={`/admin/donations/csv${query ? `?${query}` : ''}`} variant="secondary">Export CSV</LinkButton>
        </div>
      ) : null}
      {rows.length === 0 ? (
        <EmptyState title="No gifts match." help="Clear a filter, or check back after the first gift arrives." icon="sponsor" />
      ) : (
        <div>
          <table className="adm-table adm-table--always">
            <caption className="adm-sr">Donations, newest first</caption>
            <thead>
              <tr>
                <th scope="col">Date</th>
                <th scope="col">Reference</th>
                <th scope="col">Donor</th>
                <th scope="col">Amount</th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const status = DONATION_STATUS_LABELS[r.status];
                return (
                  <tr key={r.id}>
                    <td>{day(r.createdAt)}</td>
                    <td>
                      <Link href={`/admin/donations/${r.id}`} className="adm-mono">{r.reference}</Link>
                    </td>
                    <td>
                      <span>{r.anonymous ? 'Anonymous' : (r.donorName ?? 'No name given')}</span>
                      <br />
                      <span className="adm-muted adm-mono">{r.emailMasked}</span>
                    </td>
                    <td>
                      {r.status === 'needs_review' ? (
                        <>
                          <span>Expected {money(r.expectedMinor, r.currency)}</span>
                          <br />
                          <span className="adm-muted">Paid {r.paidMinor === null ? 'not known' : money(r.paidMinor, r.currency)}</span>
                        </>
                      ) : (
                        money(r.paidMinor ?? r.expectedMinor, r.currency)
                      )}
                      {r.kind === 'monthly' ? <span className="adm-muted"> every month</span> : null}
                    </td>
                    <td>
                      <Badge tone={status.tone}>{status.label}</Badge>
                      {r.test ? <Badge tone="info">Test</Badge> : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
