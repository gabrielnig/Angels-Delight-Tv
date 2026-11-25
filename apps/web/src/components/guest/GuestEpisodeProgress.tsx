'use client';

import { useEffect, useState } from 'react';
import type { SeriesLabelSetting } from '@ad/shared/series-labels';
import { applyGuestProgress } from '../../lib/guest/episodes';
import { listGuestProgress } from '../../lib/guest/progress-store';
import { EpisodeList, type SeasonRows } from '../title/EpisodeList';

/** The episode list of a series page for a visitor: what is watched comes from this device. */
export function GuestEpisodeProgress({
  seasons,
  initialSeason,
  labels,
}: {
  seasons: SeasonRows[];
  initialSeason: number;
  labels?: SeriesLabelSetting;
}) {
  const [shown, setShown] = useState(seasons);
  useEffect(() => {
    const saved = Object.fromEntries(
      listGuestProgress(window.localStorage).map(({ videoId, ...entry }) => [videoId, entry]),
    );
    setShown(applyGuestProgress(seasons, saved));
  }, [seasons]);
  return <EpisodeList seasons={shown} initialSeason={initialSeason} labels={labels} />;
}
