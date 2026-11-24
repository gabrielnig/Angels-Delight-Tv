// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { buildReport } from '@ad/sponsors';
import { SponsorPrintReport, SponsorReportView } from './SponsorReportView';

afterEach(cleanup);

const report = buildReport({
  fromDay: '2027-01-01',
  toDay: '2027-01-03',
  rows: [
    { day: '2027-01-02', creativeId: 'c1', slot: 'home_banner', impressions: 1200, clicks: 30, reach: 800 },
    { day: '2027-01-03', creativeId: 'c1', slot: 'title_card', impressions: 300, clicks: 3, reach: 200 },
  ],
  creativeNames: new Map([['c1', 'Learn with Acme']]),
});
const base = { sponsorId: 's1', sponsorName: 'Acme', report, canExport: true };

describe('SponsorReportView', () => {
  it('shows totals with a separator and the click rate as a percent', () => {
    const { container } = render(<SponsorReportView {...base} />);
    const totals = within(container.querySelector('[data-totals]') as HTMLElement);
    expect(totals.getByText('1,500')).toBeTruthy();
    expect(totals.getByText('2.2%')).toBeTruthy();
  });
  it('labels reach as a daily figure and shows the peak, not a total', () => {
    render(<SponsorReportView {...base} />);
    expect(screen.getByText(/Peak daily reach/)).toBeTruthy();
    expect(screen.getByText(/not added up/i)).toBeTruthy();
    expect(screen.queryByText(/Total reach/i)).toBeNull();
  });
  it('lists every day including empty ones, and placements in words', () => {
    render(<SponsorReportView {...base} />);
    const table = screen.getByRole('table', { name: 'Daily numbers' });
    expect(within(table).getAllByRole('row')).toHaveLength(4);
    expect(screen.getByText('Home page banner')).toBeTruthy();
  });
  it('offers the CSV only to an admin and always a print link', () => {
    const { rerender } = render(<SponsorReportView {...base} />);
    expect(screen.getByRole('link', { name: 'Download CSV' }).getAttribute('href')).toBe(
      '/admin/sponsors/s1/report/csv?from=2027-01-01&to=2027-01-03',
    );
    rerender(<SponsorReportView {...base} canExport={false} />);
    expect(screen.queryByRole('link', { name: 'Download CSV' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Print' }).getAttribute('href')).toBe(
      '/admin/sponsors/s1/report/print?from=2027-01-01&to=2027-01-03',
    );
  });
  it('shows an empty message when nothing was counted', () => {
    const empty = buildReport({ fromDay: '2027-01-01', toDay: '2027-01-02', rows: [], creativeNames: new Map() });
    render(<SponsorReportView {...base} report={empty} />);
    expect(screen.getByText('No numbers yet for these dates.')).toBeTruthy();
  });
});

describe('SponsorPrintReport', () => {
  it('shows the sponsor, dates, totals and the methodology note', () => {
    const { container } = render(<SponsorPrintReport sponsorName="Acme" report={report} generatedOn="2027-01-05" />);
    expect(screen.getByRole('heading', { name: /Acme/ })).toBeTruthy();
    expect(screen.getByText(/1 Jan 2027 to 3 Jan 2027/)).toBeTruthy();
    expect(within(container.querySelector('[data-totals]') as HTMLElement).getByText('1,500')).toBeTruthy();
    expect(screen.getByText(/Impressions count a card that was half visible for one second/)).toBeTruthy();
    expect(screen.getByText(/not added up/i)).toBeTruthy();
  });
  it('matches the on screen numbers', () => {
    const { container: a } = render(<SponsorReportView {...base} />);
    const screenTotals = a.querySelector('[data-totals]')?.textContent;
    cleanup();
    const { container: b } = render(<SponsorPrintReport sponsorName="Acme" report={report} generatedOn="2027-01-05" />);
    expect(b.querySelector('[data-totals]')?.textContent).toBe(screenTotals);
  });
  it('has a print stylesheet that hides the admin shell', () => {
    const css = readFileSync(resolve(import.meta.dirname, 'sponsor-report.css'), 'utf8');
    expect(css).toMatch(/@media print[\s\S]*\.adm-side[\s\S]*display:\s*none/);
    expect(css).toMatch(/@media print[\s\S]*\.adm-top/);
  });
});
