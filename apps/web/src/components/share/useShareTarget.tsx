'use client';

import { useCallback, useState, type ReactNode } from 'react';
import { useProfileKids } from '../../lib/profile-context';
import { buildShareConfig } from './share-config';
import { resolveShareUrl } from './resolve-url';
import { useShareSettings } from './share-context';
import { ShareSheet } from './ShareSheet';

/** Under this many seconds in, starting at the shared time means nothing. */
const MIN_START = 5;

export interface ShareTargetInput {
  kind: 'video' | 'series';
  slug: string;
  /** Catalog id, for the per title share count. Optional. */
  id?: string;
  title: string;
  thumbnail?: string;
  /** Seconds into the video when the sheet opens, for the Start at switch. Videos only. */
  getStartAt?: () => number | null;
}

/** Whether this viewer may share at all: settings were given for the page and the profile is not a kids profile. */
export function useShareEnabled(): boolean {
  return Boolean(useShareSettings()) && !useProfileKids();
}

/** The open sheet for one title. Render it next to the control and outside any hover card. */
export function ShareHost({
  input,
  onClose,
  startAt,
}: {
  input: ShareTargetInput;
  onClose: () => void;
  startAt?: number;
}) {
  const settings = useShareSettings();
  const enabled = useShareEnabled();
  if (!settings || !enabled) return null;
  const config = buildShareConfig({
    seo: { shareChannels: settings.channels, shareTemplate: settings.template, platformName: settings.siteName },
    title: input.title,
    kind: input.kind,
    slug: input.slug,
    origin: settings.origin,
    thumbnail: input.thumbnail,
  });
  return (
    <ShareSheet
      open
      onClose={onClose}
      title={input.title}
      text={config.text}
      url={resolveShareUrl(config.url)}
      kind={input.kind}
      titleId={input.id}
      {...(startAt !== undefined ? { startAt } : {})}
      channels={config.channels}
      thumbnail={config.thumbnail}
    />
  );
}

/**
 * Everything a card needs to offer Share: a handler (undefined when Share is off for this viewer) and the sheet to
 * render next to the control, outside any hover card so it survives the pointer leaving (L15a).
 */
export function useShareTarget(input: ShareTargetInput | null): {
  onShare: (() => void) | undefined;
  sheet: ReactNode;
} {
  const enabled = useShareEnabled();
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const [startAt, setStartAt] = useState<number | undefined>(undefined);
  const getStartAt = input?.getStartAt;
  const onShare = useCallback(() => {
    const seconds = getStartAt?.();
    setStartAt(seconds !== null && seconds !== undefined && seconds >= MIN_START ? Math.floor(seconds) : undefined);
    setOpen(true);
  }, [getStartAt]);
  if (!enabled || !input) return { onShare: undefined, sheet: null };
  return {
    onShare,
    sheet: open ? <ShareHost input={input} onClose={close} {...(startAt !== undefined ? { startAt } : {})} /> : null,
  };
}
