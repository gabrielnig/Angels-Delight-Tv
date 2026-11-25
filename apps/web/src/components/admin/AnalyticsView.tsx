import {
  dayLabel,
  changeLabel,
  formatWatchTime,
  rangeLabel,
} from '@/lib/data/admin/analytics-rules';
import type {
  AnalyticsOverview,
  RangePreset,
  VideoAnalytics,
} from '@/lib/data/admin/analytics-rules';
import { Badge } from './Badge';
import { Button, LinkButton } from './Button';
import { Chart } from './Chart';
import { Card } from './PageHeader';
import { ProgressBar } from './ProgressBar';
import { EmptyState } from './states';
import { TopTitlesTable } from './TopTitlesTable';

const PRESETS: Array<{ id: Exclude<RangePreset, 'custom'>; label: string }> = [
  { id: '7d', label: 'Last 7 days' },
  { id: '28d', label: 'Last 28 days' },
  { id: '90d', label: 'Last 90 days' },
];
const count = (n: number) => n.toLocaleString('en-NG');
const percent = (v: number) => `${Math.round(v * 100)}%`;

export function RangePicker({
  basePath,
  preset,
  range,
}: {
  basePath: string;
  preset: RangePreset;
  range: { from: string; to: string };
}) {
  return (
    <form
      method="get"
      action={basePath}
      className="adm-toolbar"
      aria-label="Choose a date range"
      style={{ alignItems: 'flex-end' }}
    >
      <input type="hidden" name="range" value="custom" />
      <div className="adm-row" role="group" aria-label="Quick ranges">
        {PRESETS.map((p) => (
          <LinkButton
            key={p.id}
            href={`${basePath}?range=${p.id}`}
            variant={preset === p.id ? 'primary' : 'secondary'}
            aria-current={preset === p.id ? 'true' : undefined}
          >
            {p.label}
          </LinkButton>
        ))}
      </div>
      <label className="adm-field">
        <span className="adm-field__label">From</span>
        <input className="adm-input" type="date" name="from" defaultValue={range.from} />
      </label>
      <label className="adm-field">
        <span className="adm-field__label">To</span>
        <input className="adm-input" type="date" name="to" defaultValue={range.to} />
      </label>
      <Button type="submit">Apply dates</Button>
    </form>
  );
}

function Tile({
  label,
  value,
  current,
  previous,
}: {
  label: string;
  value: string;
  current: number;
  previous: number;
}) {
  const change = changeLabel(current, previous);
  const icon = change.direction === 'up' ? 'up' : change.direction === 'down' ? 'down' : 'info';
  return (
    <div className="adm-card adm-stack" role="group" aria-label={label}>
      <span className="adm-muted">{label}</span>
      <strong className="adm-stat">{value}</strong>
      <Badge
        tone={
          change.direction === 'up'
            ? 'success'
            : change.direction === 'down'
              ? 'warning'
              : 'neutral'
        }
        icon={icon}
      >
        {change.text}
      </Badge>
    </div>
  );
}

function Split({ title, rows }: { title: string; rows: AnalyticsOverview['splits']['device'] }) {
  return (
    <Card title={title}>
      {rows.length === 0 ? (
        <p className="adm-muted" style={{ margin: 0 }}>
          Not enough data yet.
        </p>
      ) : (
        <ul className="adm-list">
          {rows.map((r) => (
            <li key={r.label}>
              <span>{r.label}</span>
              <span className="adm-num">{Math.round(r.percent)}%</span>
              <ProgressBar value={r.percent} label={`${r.label} share`} small showNumber={false} />
            </li>
          ))}
        </ul>
      )}
      <p className="adm-muted" style={{ margin: 0 }}>
        Small groups are combined as Other to protect privacy.
      </p>
    </Card>
  );
}

export function AnalyticsOverviewView({
  data,
  preset,
  exportHref,
}: {
  data: AnalyticsOverview;
  preset: RangePreset;
  exportHref: string;
}) {
  const { current: c, previous: p } = data;
  const empty = c.views === 0 && data.daily.every((d) => d.views === 0);
  return (
    <div className="adm-stack">
      <RangePicker basePath="/admin/analytics" preset={preset} range={data.range} />
      <div className="adm-row" style={{ justifyContent: 'space-between' }}>
        <p className="adm-muted" style={{ margin: 0 }} aria-live="polite">
          Showing {rangeLabel(data.range)}
        </p>
        <LinkButton href={exportHref} icon="download">
          Export CSV
        </LinkButton>
      </div>
      {empty ? (
        <EmptyState
          title="No views in this period."
          help="Pick a longer range, or check back after videos are watched."
          icon="analytics"
        />
      ) : (
        <>
          <div className="adm-tiles">
            <Tile label="Views" value={count(c.views)} current={c.views} previous={p.views} />
            <Tile
              label="Unique viewers"
              value={count(c.uniqueViewers)}
              current={c.uniqueViewers}
              previous={p.uniqueViewers}
            />
            <Tile
              label="Watch time"
              value={formatWatchTime(c.watchMs)}
              current={c.watchMs}
              previous={p.watchMs}
            />
            <Tile
              label="Finished watching"
              value={percent(c.completionRate)}
              current={c.completionRate}
              previous={p.completionRate}
            />
          </div>
          <Card title="Views each day">
            <Chart
              title="Views each day"
              noun="views"
              kind="line"
              points={data.daily.map((d) => ({ label: dayLabel(d.day), value: d.views }))}
            />
          </Card>
          <section className="adm-card adm-table-card" aria-labelledby="top-h">
            <h2
              className="adm-h3"
              id="top-h"
             
            >
              Top titles
            </h2>
            {data.top.length === 0 ? (
              <p className="adm-muted" style={{ padding: 'var(--space-4)' }}>
                No titles were watched in this period.
              </p>
            ) : (
              <TopTitlesTable top={data.top} range={data.range} />
            )}
          </section>
          <div className="adm-tiles">
            <Split title="Devices" rows={data.splits.device} />
            <Split title="Connection" rows={data.splits.connection} />
            <Split title="Countries" rows={data.splits.country} />
          </div>
        </>
      )}
    </div>
  );
}

export function VideoAnalyticsView({
  data,
  preset,
}: {
  data: VideoAnalytics;
  preset: RangePreset;
}) {
  const empty = data.totals.views === 0;
  return (
    <div className="adm-stack">
      <RangePicker
        basePath={`/admin/analytics/${data.videoId}`}
        preset={preset}
        range={data.range}
      />
      <p className="adm-muted" style={{ margin: 0 }} aria-live="polite">
        Showing {rangeLabel(data.range)}
      </p>
      <div className="adm-tiles">
        <div className="adm-card adm-stack" role="group" aria-label="Views">
          <span className="adm-muted">Views</span>
          <strong className="adm-stat">{count(data.totals.views)}</strong>
        </div>
        <div className="adm-card adm-stack" role="group" aria-label="Watch time">
          <span className="adm-muted">Watch time</span>
          <strong className="adm-stat">{formatWatchTime(data.totals.watchMs)}</strong>
        </div>
        <div className="adm-card adm-stack" role="group" aria-label="Finished watching">
          <span className="adm-muted">Finished watching</span>
          <strong className="adm-stat">{percent(data.totals.completionRate)}</strong>
        </div>
      </div>
      {empty ? (
        <EmptyState
          title="No views for this video in this period."
          help="Pick a longer range."
          icon="analytics"
        />
      ) : (
        <>
          <Card title="Views each day">
            <Chart
              title="Views each day"
              noun="views"
              kind="line"
              points={data.daily.map((d) => ({ label: dayLabel(d.day), value: d.views }))}
            />
          </Card>
          <Card title="Where viewers stop">
            <Chart
              title="Share of viewers still watching"
              noun="viewers still watching"
              kind="line"
              unit="percent"
              emptyText="Retention needs a few more views."
              points={data.retention.map((r) => ({
                label: `${r.atPercent}% in`,
                value: r.percent,
              }))}
            />
          </Card>
        </>
      )}
    </div>
  );
}
