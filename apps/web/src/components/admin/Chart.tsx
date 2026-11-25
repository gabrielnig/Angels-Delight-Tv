'use client';

import { useId, useState } from 'react';
import { describeSeries, formatCompact, layoutSeries, niceMax } from './chart-math';
import type { SeriesPoint } from './chart-math';
import { Button } from './Button';

interface ChartProps {
  title: string;
  /** What the numbers count, in plural, for the text alternative. */
  noun?: string;
  points: SeriesPoint[];
  kind?: 'line' | 'bar';
  /** Format for table values and tooltips. */
  format?: (value: number) => string;
  /** Server pages cannot pass a function to this client component, so they name the unit instead. */
  unit?: 'percent';
  /** Shown instead of a chart when there are no points. */
  emptyText?: string;
}

const W = 640;
const H = 220;
const PAD = { top: 12, right: 12, bottom: 28, left: 44 };

/** Accessible SVG chart with a "Show as table" switch. Colour is never the only signal. */
export function Chart({
  title,
  noun = 'views',
  points,
  kind = 'line',
  format,
  unit,
  emptyText,
}: ChartProps) {
  const [asTable, setAsTable] = useState(false);
  const id = useId();
  const fmt =
    format ??
    (unit === 'percent'
      ? (value: number) => `${Math.round(value)}%`
      : (value: number) => value.toLocaleString('en-NG'));
  const description = describeSeries(points, noun);

  if (points.length === 0) {
    return (
      <div className="adm-chart" role="status">
        <p className="adm-muted">{emptyText ?? `No ${noun} yet for this period.`}</p>
      </div>
    );
  }

  const max = niceMax(Math.max(...points.map((p) => p.value)));
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const laid = layoutSeries(points, plotW, plotH, max);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => ({ value: max * t, y: plotH - plotH * t }));
  const labelEvery = Math.max(1, Math.ceil(points.length / 8));
  const barW = Math.max(4, (plotW / points.length) * 0.6);

  return (
    <figure className="adm-chart" style={{ margin: 0 }}>
      <div className="adm-chart__head">
        <figcaption className="adm-h3" id={`${id}-t`}>
          {title}
        </figcaption>
        <Button variant="ghost" aria-pressed={asTable} onClick={() => setAsTable((v) => !v)}>
          {asTable ? 'Show as chart' : 'Show as table'}
        </Button>
      </div>
      {asTable ? (
        <table className="adm-chart__table">
          <caption className="adm-sr">{title}</caption>
          <thead>
            <tr>
              <th scope="col">Period</th>
              <th scope="col">{noun}</th>
            </tr>
          </thead>
          <tbody>
            {points.map((point) => (
              <tr key={point.label}>
                <th scope="row">{point.label}</th>
                <td>{fmt(point.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <>
          <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-labelledby={`${id}-t ${id}-d`}>
            <desc id={`${id}-d`}>{description}</desc>
            <g transform={`translate(${PAD.left} ${PAD.top})`}>
              {ticks.map((tick) => (
                <g key={tick.y}>
                  <line className="adm-chart__grid" x1={0} x2={plotW} y1={tick.y} y2={tick.y} />
                  <text className="adm-chart__label" x={-8} y={tick.y + 4} textAnchor="end">
                    {formatCompact(tick.value)}
                  </text>
                </g>
              ))}
              {kind === 'line' ? (
                <>
                  <path
                    className="adm-chart__area"
                    d={`M0 ${plotH} ${laid.map((p) => `L${p.x} ${p.y}`).join(' ')} L${plotW} ${plotH} Z`}
                  />
                  <polyline
                    className="adm-chart__line"
                    points={laid.map((p) => `${p.x},${p.y}`).join(' ')}
                  />
                  {laid.map((p) => (
                    <circle key={p.label} className="adm-chart__dot" cx={p.x} cy={p.y} r={3.5}>
                      <title>{`${p.label}: ${fmt(p.value)}`}</title>
                    </circle>
                  ))}
                </>
              ) : (
                laid.map((p, index) => {
                  const slot = plotW / points.length;
                  return (
                    <rect
                      key={p.label}
                      className="adm-chart__bar"
                      x={index * slot + (slot - barW) / 2}
                      y={p.y}
                      width={barW}
                      height={plotH - p.y}
                      rx={2}
                    >
                      <title>{`${p.label}: ${fmt(p.value)}`}</title>
                    </rect>
                  );
                })
              )}
              {laid.map((p, index) =>
                index % labelEvery === 0 ? (
                  <text
                    key={p.label}
                    className="adm-chart__label"
                    x={
                      kind === 'bar'
                        ? index * (plotW / points.length) + plotW / points.length / 2
                        : p.x
                    }
                    y={plotH + 18}
                    textAnchor="middle"
                  >
                    {p.label}
                  </text>
                ) : null,
              )}
              <line className="adm-chart__axis" x1={0} x2={plotW} y1={plotH} y2={plotH} />
            </g>
          </svg>
          <p className="adm-sr">{description}</p>
        </>
      )}
    </figure>
  );
}
