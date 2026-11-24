'use client';

import { useEffect, useRef, useState } from 'react';
import { msg } from '@ad/shared/messages';
import type { TitleCardDto } from '@ad/viewer';
import { ContinueRow } from '../CatalogCard';
import { buildContinueItems, pickContinueEntries } from '../../lib/guest/continue';
import {
  listGuestProgress,
  removeGuestProgress,
  writeGuestProgress,
  type GuestProgressEntry,
} from '../../lib/guest/progress-store';
import type { Progress, VideoSummary } from '../../lib/data/types';

const MAX = 20;

/**
 * The Continue learning row of a visitor (R14). The device knows where each video was left, the server only
 * names the videos, so progress never leaves the device except as a list of ids (M40-S14). The row shows nothing
 * until it has something, and nothing at all when the lookup fails.
 */
export function GuestContinueRow() {
  const [items, setItems] = useState<Array<{ video: VideoSummary; progress: Progress }>>([]);
  const saved = useRef(new Map<string, GuestProgressEntry>());

  useEffect(() => {
    const entries = pickContinueEntries(listGuestProgress(window.localStorage), MAX);
    if (entries.length === 0) return;
    for (const { videoId, ...entry } of entries) saved.current.set(videoId, entry);
    const controller = new AbortController();
    fetch(`/api/titles/batch?ids=${entries.map((e) => e.videoId).join(',')}`, {
      signal: controller.signal,
    })
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error('lookup'))))
      .then((body: { items: TitleCardDto[] }) => setItems(buildContinueItems(entries, body.items)))
      .catch(() => undefined);
    return () => controller.abort();
  }, []);

  if (items.length === 0) return null;
  return (
    <ContinueRow
      title={msg('guest.continue.title')}
      items={items}
      remove={async (videoId) => removeGuestProgress(window.localStorage, videoId)}
      restore={async (videoId) => {
        const entry = saved.current.get(videoId);
        if (entry) writeGuestProgress(window.localStorage, videoId, entry, entry.t);
      }}
    />
  );
}
