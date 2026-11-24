'use client';

import Link from 'next/link';
import { useState } from 'react';
import {
  formatWatchTime,
  ratingCells,
  sortTop,
  type TopSortKey,
} from '@/lib/data/admin/analytics-rules';
import type { TopTitle } from '@ad/analytics';

const count = (n: number) => n.toLocaleString('en-NG');
const percent = (v: number) => `${Math.round(v * 100)}%`;

const SORTABLE: Array<{ key: TopSortKey; label: string }> = [
  { key: 'views', label: 'Views' },
  { key: 'likes', label: 'Likes' },
  { key: 'loves', label: 'Love' },
  { key: 'dislikes', label: 'Not for me' },
  { key: 'share', label: 'Positive share' },
];

/** The Top titles table. Rating columns sort in the browser over the rows already loaded. */
export function TopTitlesTable({
  top,
  range,
}: {
  top: readonly TopTitle[];
  range: { from: string; to: string };
}) {
  const [sort, setSort] = useState<{ key: TopSortKey; dir: 'asc' | 'desc' }>({
    key: 'views',
    dir: 'desc',
  });
  const choose = (key: TopSortKey) =>
    setSort((now) => ({ key, dir: now.key === key && now.dir === 'desc' ? 'asc' : 'desc' }));
  const header = (key: TopSortKey, label: string) => (
    <th
      scope="col"
      className="adm-num"
      key={key}
      aria-sort={sort.key === key ? (sort.dir === 'desc' ? 'descending' : 'ascending') : undefined}
    >
      <button
        type="button"
        className="adm-sortbtn"
        aria-label={`Sort by ${label}`}
        onClick={() => choose(key)}
      >
        {label}
      </button>
    </th>
  );
  return (
    <table className="adm-table adm-table--always adm-table--sticky">
      <caption className="adm-sr">Most watched titles</caption>
      <thead>
        <tr>
          <th scope="col">Title</th>
          {header('views', 'Views')}
          <th scope="col" className="adm-num">
            Watch time
          </th>
          <th scope="col" className="adm-num">
            Finished
          </th>
          {SORTABLE.slice(1).map((c) => header(c.key, c.label))}
        </tr>
      </thead>
      <tbody>
        {sortTop(top, sort.key, sort.dir).map((t) => {
          const cells = ratingCells(t);
          return (
            <tr key={t.videoId}>
              <th scope="row">
                <Link
                  className="adm-link"
                  href={`/admin/analytics/${t.videoId}?from=${range.from}&to=${range.to}&range=custom`}
                >
                  {t.title}
                </Link>
              </th>
              <td className="adm-num">{count(t.views)}</td>
              <td className="adm-num">{formatWatchTime(t.watchMs)}</td>
              <td className="adm-num">{percent(t.completionRate)}</td>
              {cells ? (
                <>
                  <td className="adm-num">{count(cells.likes)}</td>
                  <td className="adm-num">{count(cells.loves)}</td>
                  <td className="adm-num">{count(cells.dislikes)}</td>
                  <td className="adm-num">
                    {cells.share === null ? (
                      <span className="adm-muted">Under 10 ratings</span>
                    ) : (
                      `${cells.share}%`
                    )}
                  </td>
                </>
              ) : (
                <td className="adm-num adm-muted" colSpan={4}>
                  No ratings
                </td>
              )}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
