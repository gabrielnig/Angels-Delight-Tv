// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { DonationListItem } from '@ad/payments';
import { DonationsView } from './DonationsView';

afterEach(cleanup);

const item = (over: Partial<DonationListItem> = {}): DonationListItem => ({
  id: 'd1',
  reference: 'ad-don-abcdefghij0123456789',
  status: 'succeeded',
  kind: 'one_time',
  currency: 'NGN',
  expectedMinor: 100000,
  paidMinor: 100000,
  test: false,
  anonymous: false,
  donorName: 'Chidi',
  emailMasked: 'c***@example.com',
  channel: 'card',
  reviewReason: null,
  receiptQueued: true,
  createdAt: new Date('2026-11-24T09:00:00Z'),
  paidAt: new Date('2026-11-24T09:01:00Z'),
  ...over,
});
const base = { totals: { NGN: { count: 1, minor: 100000 } }, filters: {} as Record<string, string>, canExport: true };

describe('DonationsView', () => {
  it('shows masked emails, status words, and a Test badge on test rows', () => {
    render(<DonationsView {...base} rows={[item(), item({ id: 'd2', test: true, reference: 'ad-don-zzzzzzzzzzzzzzzzzzzz' })]} />);
    expect(screen.getAllByText('c***@example.com')).toHaveLength(2);
    expect(screen.getAllByText('Succeeded')).toHaveLength(2);
    expect(screen.getAllByText('Test')).toHaveLength(1);
  });

  it('shows Anonymous instead of a name for an anonymous donor', () => {
    render(<DonationsView {...base} rows={[item({ anonymous: true, donorName: null })]} />);
    expect(screen.getByText('Anonymous')).toBeInTheDocument();
    expect(screen.queryByText('Chidi')).not.toBeInTheDocument();
  });

  it('shows expected versus paid for a gift that needs review and links to it', () => {
    render(<DonationsView {...base} rows={[item({ status: 'needs_review', expectedMinor: 500000, paidMinor: 100000, reviewReason: 'amount_lower' })]} />);
    expect(screen.getByText(/expected/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /ad-don-abcdefghij0123456789/ })).toHaveAttribute('href', '/admin/donations/d1');
    expect(screen.getByText('Needs review')).toBeInTheDocument();
  });

  it('states that totals leave out test gifts, one line per currency', () => {
    render(<DonationsView {...base} totals={{ NGN: { count: 2, minor: 150000 }, USD: { count: 1, minor: 1000 } }} rows={[item()]} />);
    const totals = screen.getByRole('region', { name: /totals/i });
    expect(within(totals).getByText(/test gifts are not counted/i)).toBeInTheDocument();
    expect(within(totals).getAllByRole('listitem')).toHaveLength(2);
  });

  it('shows an empty state with a next step, and hides Export when not allowed', () => {
    render(<DonationsView {...base} rows={[]} totals={{}} canExport={false} />);
    expect(screen.getByText(/no gifts match/i)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /export/i })).not.toBeInTheDocument();
  });

  it('keeps the chosen filters in the export link', () => {
    render(<DonationsView {...base} filters={{ status: 'failed', from: '2026-11-01' }} rows={[item()]} />);
    expect(screen.getByRole('link', { name: /export csv/i })).toHaveAttribute('href', '/admin/donations/csv?status=failed&from=2026-11-01');
  });
});
