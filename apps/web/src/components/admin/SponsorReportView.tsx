import type { Report } from '@ad/sponsors';
import { LinkButton } from './Button';
import { EmptyState } from './states';
import { SLOT_LABELS, dayLabel } from './sponsor-labels';
import './sponsor-report.css';

const nf = new Intl.NumberFormat('en-NG');
const num = (n: number) => nf.format(n);
const pct = (fraction: number) => `${(fraction * 100).toFixed(1)}%`;

export const METHOD_NOTE =
  'Impressions count a card that was half visible for one second. Clicks are counted when the link is followed. Cards shown to children are never counted. Staff previews are not counted.';

function Totals({ report }: { report: Report }) {
  const t = report.totals;
  return (
    <div className="spr-tiles" data-totals>
      <div className="spr-tile">
        <span className="spr-tile__value">{num(t.impressions)}</span>
        <span className="spr-tile__label">Impressions</span>
      </div>
      <div className="spr-tile">
        <span className="spr-tile__value">{num(t.clicks)}</span>
        <span className="spr-tile__label">Clicks</span>
      </div>
      <div className="spr-tile">
        <span className="spr-tile__value">{pct(t.clickRate)}</span>
        <span className="spr-tile__label">Click rate</span>
      </div>
      <div className="spr-tile">
        <span className="spr-tile__value">{num(t.peakDailyReach)}</span>
        <span className="spr-tile__label">Peak daily reach</span>
      </div>
    </div>
  );
}

function Tables({ report }: { report: Report }) {
  return (
    <>
      <div className="adm-card adm-table-card spr-scroll">
        <table className="adm-table" aria-label="Daily numbers">
          <thead>
            <tr>
              <th scope="col">Day</th>
              <th scope="col">Impressions</th>
              <th scope="col">Clicks</th>
              <th scope="col">Click rate</th>
              <th scope="col">Daily reach</th>
            </tr>
          </thead>
          <tbody>
            {report.days.map((d) => (
              <tr key={d.day}>
                <th scope="row">{dayLabel(d.day)}</th>
                <td>{num(d.impressions)}</td>
                <td>{num(d.clicks)}</td>
                <td>{pct(d.clickRate)}</td>
                <td>{num(d.dailyReach)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="adm-card adm-table-card spr-scroll">
        <table className="adm-table" aria-label="By creative">
          <thead>
            <tr>
              <th scope="col">Creative</th>
              <th scope="col">Impressions</th>
              <th scope="col">Clicks</th>
              <th scope="col">Click rate</th>
            </tr>
          </thead>
          <tbody>
            {report.byCreative.map((c) => (
              <tr key={c.creativeId}>
                <th scope="row">{c.headline}</th>
                <td>{num(c.impressions)}</td>
                <td>{num(c.clicks)}</td>
                <td>{pct(c.clickRate)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="adm-card adm-table-card spr-scroll">
        <table className="adm-table" aria-label="By placement">
          <thead>
            <tr>
              <th scope="col">Placement</th>
              <th scope="col">Impressions</th>
              <th scope="col">Clicks</th>
              <th scope="col">Click rate</th>
            </tr>
          </thead>
          <tbody>
            {report.bySlot.map((s) => (
              <tr key={s.slot}>
                <th scope="row">{SLOT_LABELS[s.slot]}</th>
                <td>{num(s.impressions)}</td>
                <td>{num(s.clicks)}</td>
                <td>{pct(s.clickRate)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

const query = (r: Report) => `from=${r.fromDay}&to=${r.toDay}`;

/** The on screen report. A plain form (GET) changes the dates, so it works without scripts. */
export function SponsorReportView({
  sponsorId,
  report,
  canExport,
}: {
  sponsorId: string;
  sponsorName: string;
  report: Report;
  canExport: boolean;
}) {
  const empty = report.totals.impressions === 0 && report.totals.clicks === 0;
  return (
    <div className="adm-stack">
      <form className="adm-row spr-noprint" method="get">
        <label className="adm-field__label">
          From
          <input className="adm-input" type="date" name="from" defaultValue={report.fromDay} />
        </label>
        <label className="adm-field__label">
          To
          <input className="adm-input" type="date" name="to" defaultValue={report.toDay} />
        </label>
        <button className="adm-btn adm-btn--secondary" type="submit">
          Show
        </button>
      </form>
      <div className="adm-row spr-noprint">
        {canExport ? (
          <LinkButton href={`/admin/sponsors/${sponsorId}/report/csv?${query(report)}`} icon="download">
            Download CSV
          </LinkButton>
        ) : null}
        <LinkButton href={`/admin/sponsors/${sponsorId}/report/print?${query(report)}`} variant="secondary">
          Print
        </LinkButton>
      </div>
      {empty ? <EmptyState title="No numbers yet for these dates." help="Numbers appear once a live card has been seen." icon="sponsor" /> : null}
      <Totals report={report} />
      <p className="spr-note">{report.reachNote}</p>
      <Tables report={report} />
      <p className="spr-note">{METHOD_NOTE}</p>
    </div>
  );
}

/** The print page: the same numbers with the sponsor name, dates and method note, and no admin controls. */
export function SponsorPrintReport({
  sponsorName,
  report,
  generatedOn,
}: {
  sponsorName: string;
  report: Report;
  generatedOn: string;
}) {
  return (
    <article className="adm-stack">
      <h1 className="adm-h1">{sponsorName}: sponsor report</h1>
      <p>
        {dayLabel(report.fromDay)} to {dayLabel(report.toDay)}
      </p>
      <Totals report={report} />
      <p className="spr-note">{report.reachNote}</p>
      <Tables report={report} />
      <p className="spr-note">{METHOD_NOTE}</p>
      <p className="spr-note">Made on {dayLabel(generatedOn)}.</p>
    </article>
  );
}
