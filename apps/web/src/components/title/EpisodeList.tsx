'use client';

import { useState } from 'react';
import { Link, ProgressBar, Select, formatDuration } from '@ad/ui';

export interface EpisodeRow {
  number: number;
  title: string;
  blurb: string;
  durationSeconds: number;
  href: string;
  watched: boolean;
  /** 1 to 99 when partly watched. */
  percent?: number;
}

export interface SeasonRows {
  number: number;
  episodes: EpisodeRow[];
}

/** Season selector with an episode list. Watched and in-progress are shown in text as well as colour. */
export function EpisodeList({
  seasons,
  initialSeason,
}: {
  seasons: SeasonRows[];
  initialSeason: number;
}) {
  const [season, setSeason] = useState(initialSeason);
  const current = seasons.find((s) => s.number === season) ?? seasons[0];
  if (!current) return null;
  const count = current.episodes.length;

  return (
    <div className="web-episodes">
      {seasons.length > 1 ? (
        <Select
          label="Season"
          value={String(season)}
          onChange={(event) => setSeason(Number(event.target.value))}
        >
          {seasons.map((s) => (
            <option key={s.number} value={s.number}>
              Season {s.number}
            </option>
          ))}
        </Select>
      ) : null}
      <p className="web-episodes__count" aria-live="polite">
        {`Season ${current.number}, ${count} ${count === 1 ? 'episode' : 'episodes'}`}
      </p>
      <ol className="web-episodes__list">
        {current.episodes.map((episode) => (
          <li key={episode.number} className="web-episode">
            <Link href={episode.href} className="web-episode__link">
              <span className="web-episode__num" aria-hidden="true">
                {episode.number}
              </span>
              <span className="web-episode__body">
                <span className="web-episode__title">
                  Episode {episode.number}: {episode.title}
                </span>
                <span className="web-episode__blurb">{episode.blurb}</span>
              </span>
              <span className="web-episode__meta">
                {formatDuration(episode.durationSeconds)}
                {episode.watched ? <span className="web-episode__done"> Watched</span> : null}
              </span>
            </Link>
            {episode.percent ? (
              <ProgressBar
                value={episode.percent}
                label={`Episode ${episode.number} progress`}
                size="sm"
              />
            ) : null}
          </li>
        ))}
      </ol>
    </div>
  );
}
