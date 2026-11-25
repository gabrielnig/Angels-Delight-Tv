'use client';

import { useEffect, useState } from 'react';
import { listGuestProgress, readGuestProgress } from '../../lib/guest/progress-store';
import { guestPrimary } from '../../lib/guest/resume';
import { guestSeriesPrimary, type GuestSeriesEpisode } from '../../lib/guest/series-resume';
import type { PrimaryAction } from '../../lib/title-cta';
import type { SeriesLabelSetting } from '@ad/shared/series-labels';

/** What a guest's main button needs to follow this device (M40, M51-S06). */
export interface GuestPlace {
  /** A video page: the video whose saved place the button follows. */
  videoId?: string;
  durationSeconds?: number;
  /** A series page: the items in order, so the button points at the first unfinished one. */
  series?: { episodes: GuestSeriesEpisode[]; labels?: SeriesLabelSetting };
}

/** The server button until this device has a saved place, then Resume, Play next or Watch again. */
export function useGuestPrimary(server: PrimaryAction, guest?: GuestPlace): PrimaryAction {
  const [primary, setPrimary] = useState(server);
  const videoId = guest?.videoId;
  const duration = guest?.durationSeconds ?? 0;
  const series = guest?.series;
  useEffect(() => {
    if (videoId) {
      const entry = readGuestProgress(window.localStorage, videoId);
      setPrimary(guestPrimary({ watchHref: server.href, durationSeconds: duration }, entry));
      return;
    }
    if (series) {
      const saved = Object.fromEntries(
        listGuestProgress(window.localStorage).map(({ videoId: id, ...entry }) => [id, entry]),
      );
      setPrimary(guestSeriesPrimary(series, saved, server));
    }
  }, [videoId, duration, series, server]);
  return primary;
}
