'use client';

import { useCallback, useState, type ReactNode } from 'react';
import { useProfileKids } from '../../lib/profile-context';
import { buildShareConfig } from './share-config';
import { resolveShareUrl } from './resolve-url';
import { useShareSettings } from './share-context';
import { ShareSheet } from './ShareSheet';

export interface ShareTargetInput {
  kind: 'video' | 'series';
  slug: string;
  title: string;
  thumbnail?: string;
}

/** Whether this viewer may share at all: settings were given for the page and the profile is not a kids profile. */
export function useShareEnabled(): boolean {
  return Boolean(useShareSettings()) && !useProfileKids();
}

/** The open sheet for one title. Render it next to the control and outside any hover card. */
export function ShareHost({ input, onClose }: { input: ShareTargetInput; onClose: () => void }) {
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
  const onShare = useCallback(() => setOpen(true), []);
  if (!enabled || !input) return { onShare: undefined, sheet: null };
  return { onShare, sheet: open ? <ShareHost input={input} onClose={close} /> : null };
}
