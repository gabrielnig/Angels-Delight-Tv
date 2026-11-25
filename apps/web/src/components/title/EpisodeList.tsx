'use client';

import { useT } from '../../lib/i18n/provider';
import { useState } from 'react';
import { Link, ProgressBar, Select, formatDuration } from '@ad/ui';
import {
  groupName,
  groupSummary,
  groupWord,
  itemName,
  resolveSeriesLabels,
  type SeriesLabelSetting,
} from '@ad/shared/series-labels';

export interface EpisodeRow {
  number: number;
  title: string;
  blurb: string;
  durationSeconds: number;
  href: string;
  watched: boolean;
  /** 1 to 99 when partly watched. */
  percent?: number;
  /** The episode the main button opens. */
  current?: boolean;
}

export interface SeasonRows {
  number: number;
  /** The group's own title, such as Genesis. Shown instead of the numbered name. */
  title?: string | null;
  episodes: EpisodeRow[];
}

/** Season selector with an episode list. Watched and in-progress are shown in text as well as colour. */
export function EpisodeList({
  seasons,
  initialSeason,
  labels,
}: {
  seasons: SeasonRows[];
  initialSeason: number;
  /** The group and item words of the series. Absent means the site default words. */
  labels?: SeriesLabelSetting;
}) {
  const msg = useT();
  const words = resolveSeriesLabels(labels, null, msg);
  const [season, setSeason] = useState(initialSeason);
  const current = seasons.find((s) => s.number === season) ?? seasons[0];
  if (!current) return null;
  const count = current.episodes.length;

  return (
    <div className="web-episodes">
      {seasons.length > 1 ? (
        <Select
          label={groupWord(words, 1)}
          value={String(season)}
          onChange={(event) => {
            const next = Number(event.target.value);
            setSeason(next);
            // Replace, not push: the choice is shareable but Back still leaves the page.
            const url = new URL(window.location.href);
            url.searchParams.set('season', String(next));
            window.history.replaceState(window.history.state, '', url);
          }}
        >
          {seasons.map((s) => (
            <option key={s.number} value={s.number}>
              {groupName(words, s.number, s.title, msg)}
            </option>
          ))}
        </Select>
      ) : null}
      <p className="web-episodes__count" aria-live="polite">
        {groupSummary(words, current.number, count, msg, current.title)}
      </p>
      <ol className="web-episodes__list">
        {current.episodes.map((episode) => (
          <li key={episode.number} className="web-episode">
            <Link
              href={episode.href}
              className="web-episode__link"
              aria-current={episode.current ? 'true' : undefined}
              data-current={episode.current ? 'true' : undefined}
            >
              <span className="web-episode__num" aria-hidden="true">
                {episode.number}
              </span>
              <span className="web-episode__body">
                <span className="web-episode__title">
                  {msg('series.labels.itemTitle', {
                    item: itemName(words, episode.number, msg),
                    title: episode.title,
                  })}
                  {episode.current ? (
                    <span className="web-episode__now"> {msg('title.upNext')}</span>
                  ) : null}
                </span>
                <span className="web-episode__blurb">{episode.blurb}</span>
              </span>
              <span className="web-episode__meta">
                {formatDuration(episode.durationSeconds)}
                {episode.watched ? (
                  <span className="web-episode__done"> {msg('title.watched')}</span>
                ) : null}
              </span>
            </Link>
            {episode.percent ? (
              <ProgressBar
                value={episode.percent}
                label={msg('series.labels.itemProgress', {
                  item: itemName(words, episode.number, msg),
                })}
                size="sm"
              />
            ) : null}
          </li>
        ))}
      </ol>
    </div>
  );
}
